import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors });
      return;
    }

    next();
  };
};

// ── Schémas de validation ────────────────────────────────────────
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email invalide',
    'any.required': 'Email requis',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Mot de passe : 8 caractères minimum',
    'any.required': 'Mot de passe requis',
  }),
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  role: Joi.string()
    .valid('CLIENT', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN')
    .default('CLIENT'),
});

export const verifyRegistrationOtpSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'userId invalide',
    'any.required': 'userId requis',
  }),
  code: Joi.string().length(6).required().messages({
    'string.length': 'Le code OTP doit contenir 6 chiffres',
    'any.required': 'Code OTP requis',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  totpCode: Joi.string().length(6).optional(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token requis',
  }),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const twoFAVerifySchema = Joi.object({
  token: Joi.string().length(6).required().messages({
    'string.length': 'Le code TOTP doit contenir 6 chiffres',
    'any.required': 'Code TOTP requis',
  }),
});

export const twoFAEnableSchema = Joi.object({
  secret: Joi.string().required(),
  token: Joi.string().length(6).required(),
});

export const avatarUpdateSchema = Joi.object({
  avatarUrl: Joi.string().required().messages({
    'any.required': 'URL/base64 avatar requis',
  }),
});

export const fcmTokenSchema = Joi.object({
  fcmToken: Joi.string().required().messages({
    'any.required': 'Token FCM requis',
  }),
});
