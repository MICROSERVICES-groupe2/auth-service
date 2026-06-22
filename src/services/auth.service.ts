import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config';
import { User, RefreshToken } from '../models';
import { redisSet, redisGet, redisDel } from '../config/redis';
import {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshTokenToDB,
  verifyRefreshToken,
  revokeRefreshToken,
  blacklistToken,
  verifyAccessToken,
} from './token.service';
import { verifyTwoFACode } from './twofa.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: 'CLIENT' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  clientId: string | null;
  role: string;
  twoFaEnabled: boolean;
  isVerified: boolean;
}

const toUserProfile = (user: User): UserProfile => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  clientId: user.clientId || null,
  role: user.role,
  twoFaEnabled: user.twoFaEnabled,
  isVerified: user.isVerified,
});

// ── Register ────────────────────────────────────────────────────
export const registerUser = async (
  input: RegisterInput
): Promise<{ user: UserProfile; otpRequired: true; otp?: string }> => {
  const { email, password, firstName, lastName, phone, role = 'CLIENT' } = input;

  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('EMAIL_ALREADY_EXISTS');

  const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
  const user = await User.create({
    email,
    passwordHash,
    firstName: firstName || null,
    lastName: lastName || null,
    phone: phone || null,
    role,
    isVerified: false,
  });

  // Generate registration OTP and store in Redis (10 min TTL)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await redisSet(`register-otp:${user.id}`, otp, 600);

  // TODO: send OTP via email/SMS using notification-service
  console.log(`[REGISTRATION OTP for ${user.email}] ${otp}`);

  return { user: toUserProfile(user), otpRequired: true, otp };
};

// ── Verify registration OTP ─────────────────────────────────────
export const verifyRegistrationOtp = async (
  userId: string,
  code: string
): Promise<UserProfile> => {
  const key = `register-otp:${userId}`;
  const stored = await redisGet(key);

  if (!stored || stored !== code) {
    throw new Error('INVALID_OTP');
  }

  const user = await User.findByPk(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  await user.update({ isVerified: true });
  await redisDel(key);

  // Auto-create client profile if not linked yet
  if (!user.clientId) {
    try {
      const clientResponse = await fetch(`${config.clientService.url}/api/v1/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: user.lastName || user.email.split('@')[0],
          prenom: user.firstName || 'Utilisateur',
          email: user.email,
          telephone: user.phone || '+0000000000',
          dateNaissance: '1990-01-01',
          adresse: 'Adresse à compléter',
        }),
      });
      if (clientResponse.ok) {
        const clientData = await clientResponse.json() as any;
        if (clientData?.id) {
          await user.update({ clientId: clientData.id });
        }
      }
    } catch (err) {
      console.error('Failed to auto-create client profile:', err);
    }
  }

  return toUserProfile(user);
};

// ── Login ────────────────────────────────────────────────────────
export const loginUser = async (
  email: string,
  password: string,
  totpCode?: string
): Promise<AuthTokens & { user: UserProfile }> => {
  const user = await User.findOne({ where: { email, isActive: true } });
  if (!user || !user.passwordHash) throw new Error('INVALID_CREDENTIALS');

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) throw new Error('INVALID_CREDENTIALS');

  // Vérification 2FA si activé
  if (user.twoFaEnabled) {
    if (!totpCode) throw new Error('TWO_FA_REQUIRED');
    if (!user.twoFaSecret) throw new Error('TWO_FA_NOT_CONFIGURED');
    const valid = verifyTwoFACode(user.twoFaSecret, totpCode);
    if (!valid) throw new Error('TWO_FA_INVALID');
  }

  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await saveRefreshTokenToDB(refreshToken, user.id);

  // Stocker session Redis TTL 24h
  await redisSet(
    `session:${user.id}`,
    JSON.stringify({ userId: user.id, email: user.email, role: user.role }),
    86400
  );

  return { accessToken, refreshToken, user: toUserProfile(user) };
};

// ── Refresh ──────────────────────────────────────────────────────
export const refreshAccessToken = async (refreshToken: string): Promise<AuthTokens> => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const tokenRecord = await RefreshToken.findOne({
    where: { token: refreshToken, isRevoked: false },
  });
  if (!tokenRecord) throw new Error('REFRESH_TOKEN_REVOKED');
  if (new Date() > tokenRecord.expiresAt) throw new Error('REFRESH_TOKEN_EXPIRED');

  const user = await User.findByPk(decoded.id);
  if (!user || !user.isActive) throw new Error('USER_NOT_FOUND');

  // Rotation : on révoque l'ancien et on génère un nouveau
  await revokeRefreshToken(refreshToken);

  const payload = { id: user.id, email: user.email, role: user.role };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  await saveRefreshTokenToDB(newRefreshToken, user.id);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// ── Logout ───────────────────────────────────────────────────────
export const logoutUser = async (
  accessToken: string,
  refreshToken: string
): Promise<void> => {
  // Blacklister l'access token
  try {
    const decoded = verifyAccessToken(accessToken);
    const exp = (decoded as any).exp;
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await blacklistToken(decoded.jti, ttl);
  } catch {
    // Token déjà expiré, pas grave
  }

  // Révoquer le refresh token
  await revokeRefreshToken(refreshToken);
};

// ── Logout All ───────────────────────────────────────────────────
export const logoutAllSessions = async (userId: string): Promise<void> => {
  await RefreshToken.update(
    { isRevoked: true },
    { where: { userId, isRevoked: false } }
  );
  await redisDel(`session:${userId}`);
};

// ── Update profile picture ───────────────────────────────────────
export const updateProfilePicture = async (
  userId: string,
  avatarUrl: string
): Promise<UserProfile> => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  await user.update({ avatarUrl });
  return toUserProfile(user);
};

// ── Update FCM token ─────────────────────────────────────────────
export const updateFcmToken = async (
  userId: string,
  fcmToken: string
): Promise<void> => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  await user.update({ fcmToken });
};

// ── Google OAuth ─────────────────────────────────────────────────
export const findOrCreateGoogleUser = async (
  googleId: string,
  email: string,
  displayName: string
): Promise<AuthTokens & { user: UserProfile }> => {
  let user = await User.findOne({ where: { googleId } });

  if (!user) {
    user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({ googleId });
    } else {
      const nameParts = displayName ? displayName.split(' ') : ['', ''];
      user = await User.create({
        email,
        passwordHash: null,
        role: 'CLIENT',
        googleId,
        firstName: nameParts[0] || null,
        lastName: nameParts.slice(1).join(' ') || null,
        isVerified: true,
      });
    }
  }

  if (!user.isActive) throw new Error('ACCOUNT_DISABLED');

  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await saveRefreshTokenToDB(refreshToken, user.id);
  await redisSet(
    `session:${user.id}`,
    JSON.stringify({ userId: user.id, email: user.email, role: user.role }),
    86400
  );

  return { accessToken, refreshToken, user: toUserProfile(user) };
};

