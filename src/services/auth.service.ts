import bcrypt from 'bcrypt';
import { config } from '../config';
import { User, RefreshToken } from '../models';
import { redisSet, redisDel } from '../config/redis';
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

// ── Register ────────────────────────────────────────────────────
export const registerUser = async (
  email: string,
  password: string,
  role: 'CLIENT' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN' = 'CLIENT'
): Promise<{ id: string; email: string; role: string }> => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('EMAIL_ALREADY_EXISTS');

  const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
  const user = await User.create({ email, passwordHash, role });

  return { id: user.id, email: user.email, role: user.role };
};

// ── Login ────────────────────────────────────────────────────────
export const loginUser = async (
  email: string,
  password: string,
  totpCode?: string
): Promise<AuthTokens> => {
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

  return { accessToken, refreshToken };
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

// ── Google OAuth ─────────────────────────────────────────────────
export const findOrCreateGoogleUser = async (
  googleId: string,
  email: string,
  displayName: string
): Promise<AuthTokens> => {
  let user = await User.findOne({ where: { googleId } });

  if (!user) {
    user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({ googleId });
    } else {
      user = await User.create({
        email,
        passwordHash: null,
        role: 'CLIENT',
        googleId,
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

  return { accessToken, refreshToken };
};