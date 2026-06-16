import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isTokenBlacklisted } from '../services/token.service';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  jti: string;
}

export interface AuthRequest extends Request {
  currentUser?: AuthUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'TOKEN_MISSING', message: 'Token manquant' });
      return;
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token expiré' });
      } else {
        res.status(401).json({ error: 'TOKEN_INVALID', message: 'Token invalide' });
      }
      return;
    }

    const blacklisted = await isTokenBlacklisted(decoded.jti);
    if (blacklisted) {
      res.status(401).json({ error: 'TOKEN_REVOKED', message: 'Token révoqué' });
      return;
    }

    req.currentUser = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      jti: decoded.jti,
    };

    next();
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur interne' });
  }
};