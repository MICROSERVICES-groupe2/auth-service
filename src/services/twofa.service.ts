import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export interface TwoFASetup {
  secret: string;
  qrCodeUrl: string;
  otpauthUrl: string;
}

export const generateTwoFASecret = async (email: string): Promise<TwoFASetup> => {
  const secret = speakeasy.generateSecret({
    name: `BankPlatform (${email})`,
    length: 20,
  });

  const otpauthUrl = secret.otpauth_url || '';
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret: secret.base32,
    otpauthUrl,
    qrCodeUrl,
  };
};

export const verifyTwoFACode = (secret: string, token: string): boolean => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
};