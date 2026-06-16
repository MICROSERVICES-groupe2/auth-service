import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authenticate';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  logoutAllSessions,
  findOrCreateGoogleUser,
} from '../services/auth.service';
import {
  generateTwoFASecret,
  verifyTwoFACode,
} from '../services/twofa.service';
import { User } from '../models';
import {
  verifyAccessToken,
  generateAccessToken,
  generateRefreshToken,
  saveRefreshTokenToDB,
} from '../services/token.service';

// ── Register ─────────────────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    const user = await registerUser(email, password, role);
    res.status(201).json({ message: 'Compte créé avec succès', user });
  } catch (error: any) {
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS', message: 'Email déjà utilisé' });
      return;
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: "Erreur lors de l'inscription" });
  }
};

// ── Login ─────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, totpCode } = req.body;
    const tokens = await loginUser(email, password, totpCode);
    res.status(200).json({ message: 'Connexion réussie', ...tokens });
  } catch (error: any) {
    const errorMap: Record<string, { status: number; message: string }> = {
      INVALID_CREDENTIALS:    { status: 401, message: 'Email ou mot de passe incorrect' },
      TWO_FA_REQUIRED:        { status: 403, message: 'Code 2FA requis' },
      TWO_FA_INVALID:         { status: 401, message: 'Code 2FA invalide' },
      TWO_FA_NOT_CONFIGURED:  { status: 500, message: 'Erreur configuration 2FA' },
    };
    const mapped = errorMap[error.message];
    if (mapped) {
      res.status(mapped.status).json({ error: error.message, message: mapped.message });
      return;
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la connexion' });
  }
};

// ── Refresh ───────────────────────────────────────────────────────
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const tokens = await refreshAccessToken(refreshToken);
    res.status(200).json({ message: 'Token renouvelé', ...tokens });
  } catch (error: any) {
    const errorMap: Record<string, { status: number; message: string }> = {
      INVALID_REFRESH_TOKEN:  { status: 401, message: 'Refresh token invalide' },
      REFRESH_TOKEN_REVOKED:  { status: 401, message: 'Refresh token révoqué' },
      REFRESH_TOKEN_EXPIRED:  { status: 401, message: 'Refresh token expiré' },
      USER_NOT_FOUND:         { status: 404, message: 'Utilisateur introuvable' },
    };
    const mapped = errorMap[error.message];
    if (mapped) {
      res.status(mapped.status).json({ error: error.message, message: mapped.message });
      return;
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors du renouvellement' });
  }
};

// ── Logout ────────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.split(' ')[1];
    const { refreshToken } = req.body;
    await logoutUser(accessToken, refreshToken);
    res.status(200).json({ message: 'Déconnexion réussie' });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la déconnexion' });
  }
};

// ── Logout All ────────────────────────────────────────────────────
export const logoutAll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await logoutAllSessions(req.currentUser!.id);
    res.status(200).json({ message: 'Toutes les sessions révoquées' });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la déconnexion globale' });
  }
};

// ── Me ────────────────────────────────────────────────────────────
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findByPk(req.currentUser!.id, {
      attributes: ['id', 'email', 'role', 'twoFaEnabled', 'isActive', 'createdAt'],
    });
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Utilisateur introuvable' });
      return;
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur interne' });
  }
};

// ── 2FA Setup ─────────────────────────────────────────────────────
export const twoFASetup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findByPk(req.currentUser!.id);
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Utilisateur introuvable' });
      return;
    }
    if (user.twoFaEnabled) {
      res.status(400).json({ error: '2FA_ALREADY_ENABLED', message: '2FA déjà activé' });
      return;
    }
    const setup = await generateTwoFASecret(user.email);
    res.status(200).json({
      message: 'Scannez le QR code avec votre application authenticator',
      secret: setup.secret,
      qrCode: setup.qrCodeUrl,
      otpauthUrl: setup.otpauthUrl,
    });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur configuration 2FA' });
  }
};

// ── 2FA Enable ────────────────────────────────────────────────────
export const twoFAEnable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { secret, token } = req.body;
    const valid = verifyTwoFACode(secret, token);
    if (!valid) {
      res.status(401).json({ error: 'TWO_FA_INVALID', message: 'Code invalide' });
      return;
    }
    await User.update(
      { twoFaSecret: secret, twoFaEnabled: true },
      { where: { id: req.currentUser!.id } }
    );
    res.status(200).json({ message: '2FA activé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur activation 2FA' });
  }
};

// ── 2FA Verify ────────────────────────────────────────────────────
export const twoFAVerify = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const user = await User.findByPk(req.currentUser!.id);
    if (!user || !user.twoFaSecret) {
      res.status(400).json({ error: '2FA_NOT_CONFIGURED', message: '2FA non configuré' });
      return;
    }
    const valid = verifyTwoFACode(user.twoFaSecret, token);
    if (!valid) {
      res.status(401).json({ error: 'TWO_FA_INVALID', message: 'Code invalide' });
      return;
    }
    res.status(200).json({ message: 'Code 2FA valide', verified: true });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur vérification 2FA' });
  }
};

// ── Biométrique simulée ───────────────────────────────────────────
export const biometricLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { biometricToken } = req.body;
    if (!biometricToken) {
      res.status(400).json({ error: 'MISSING_TOKEN', message: 'Token biométrique manquant' });
      return;
    }
    let decoded;
    try {
      decoded = verifyAccessToken(biometricToken);
    } catch {
      res.status(401).json({ error: 'INVALID_BIOMETRIC_TOKEN', message: 'Token biométrique invalide' });
      return;
    }
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'USER_INACTIVE', message: 'Utilisateur inactif' });
      return;
    }
    const payload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await saveRefreshTokenToDB(refreshToken, user.id);
    res.status(200).json({ message: 'Authentification biométrique réussie', accessToken, refreshToken });
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur authentification biométrique' });
  }
};

// ── Google OAuth Callback ─────────────────────────────────────────
export const googleCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const googleUser = req.currentUser as any;
    const tokens = await findOrCreateGoogleUser(
      googleUser.googleId,
      googleUser.email,
      googleUser.displayName || ''
    );
    res.status(200).json({ message: 'Connexion Google réussie', ...tokens });
  } catch (error: any) {
    if (error.message === 'ACCOUNT_DISABLED') {
      res.status(403).json({ error: 'ACCOUNT_DISABLED', message: 'Compte désactivé' });
      return;
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur connexion Google' });
  }
};