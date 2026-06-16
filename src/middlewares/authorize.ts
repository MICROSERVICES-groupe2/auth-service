import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Non authentifié' });
      return;
    }

    if (!roles.includes(req.currentUser.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Accès refusé. Rôles autorisés : ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
};