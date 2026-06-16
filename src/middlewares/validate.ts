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
  role: Joi.string()
    .valid('CLIENT', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN')
    .default('CLIENT'),
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