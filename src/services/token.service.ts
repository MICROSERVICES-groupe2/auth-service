import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { redisSet, redisGet } from '../config/redis';
import { RefreshToken } from '../models';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  jti: string;
}

export const generateAccessToken = (payload: Omit<TokenPayload, 'jti'>): string => {
  const jti = uuidv4();
  const options: SignOptions = { expiresIn: '15m', jwtid: jti };
  return jwt.sign(payload, config.jwt.secret, options);
};

export const generateRefreshToken = (payload: Omit<TokenPayload, 'jti'>): string => {
  const jti = uuidv4();
  const options: SignOptions = { expiresIn: '7d', jwtid: jti };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, config.jwt.secret) as any;
  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    jti: decoded.jti,
  };
};

export const verifyRefreshToken = (token: string): TokenPayload & { exp: number } => {
  const decoded = jwt.verify(token, config.jwt.refreshSecret) as any;
  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    jti: decoded.jti,
    exp: decoded.exp,
  };
};

export const blacklistToken = async (jti: string, ttlSeconds: number): Promise<void> => {
  await redisSet(`blacklist:${jti}`, '1', ttlSeconds);
};

export const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
  const result = await redisGet(`blacklist:${jti}`);
  return result !== null;
};

export const saveRefreshTokenToDB = async (
  token: string,
  userId: string
): Promise<void> => {
  const decoded = verifyRefreshToken(token);
  const expiresAt = new Date(decoded.exp * 1000);
  await RefreshToken.create({ token, userId, expiresAt });
};

export const revokeRefreshToken = async (token: string): Promise<void> => {
  await RefreshToken.update({ isRevoked: true }, { where: { token } });
};

export const revokeAllUserRefreshTokens = async (userId: string): Promise<void> => {
  await RefreshToken.update(
    { isRevoked: true },
    { where: { userId, isRevoked: false } }
  );
};