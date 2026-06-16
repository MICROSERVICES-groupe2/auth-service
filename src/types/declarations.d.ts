declare module 'speakeasy' {
  interface GeneratedSecret {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
  }

  interface GenerateSecretOptions {
    length?: number;
    name?: string;
    issuer?: string;
  }

  interface TotpVerifyOptions {
    secret: string;
    encoding: 'ascii' | 'hex' | 'base32';
    token: string;
    window?: number;
  }

  export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;

  export const totp: {
    verify(options: TotpVerifyOptions): boolean;
    generate(options: { secret: string; encoding: string }): string;
  };
}

declare module 'qrcode' {
  export function toDataURL(text: string): Promise<string>;
  export function toString(text: string): Promise<string>;
}