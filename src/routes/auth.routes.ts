import { Router, RequestHandler } from 'express';
import passport from 'passport';
import {
  register, login, refresh, logout, logoutAll,
  getMe, twoFASetup, twoFAEnable, twoFAVerify,
  biometricLogin, googleCallback,
  verifyRegistrationOTP, updateAvatar, updateFcmToken,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  validate, registerSchema, loginSchema, refreshSchema,
  logoutSchema, twoFAVerifySchema, twoFAEnableSchema,
  verifyRegistrationOtpSchema, avatarUpdateSchema, fcmTokenSchema,
} from '../middlewares/validate';

const router = Router();

// ── Public ────────────────────────────────────────────────────────
router.post('/register',  validate(registerSchema), register as RequestHandler);
router.post('/verify-registration-otp', validate(verifyRegistrationOtpSchema), verifyRegistrationOTP as RequestHandler);
router.post('/login',     validate(loginSchema),    login    as RequestHandler);
router.post('/refresh',   validate(refreshSchema),  refresh  as RequestHandler);
router.post('/biometric', biometricLogin            as RequestHandler);

// ── Google OAuth ──────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/error' }),
  googleCallback as RequestHandler
);
router.get('/google/error', ((_req, res) => {
  res.status(401).json({ error: 'GOOGLE_AUTH_FAILED', message: 'Échec authentification Google' });
}) as RequestHandler);

// ── Protégées ─────────────────────────────────────────────────────
router.post('/logout',     authenticate as RequestHandler, validate(logoutSchema), logout    as RequestHandler);
router.post('/logout/all', authenticate as RequestHandler,                         logoutAll as RequestHandler);
router.get('/me',          authenticate as RequestHandler,                         getMe     as RequestHandler);

router.post('/avatar',     authenticate as RequestHandler, validate(avatarUpdateSchema), updateAvatar as RequestHandler);
router.post('/fcm-token',  authenticate as RequestHandler, validate(fcmTokenSchema),     updateFcmToken as RequestHandler);

// ── 2FA ───────────────────────────────────────────────────────────
router.post('/2fa/setup',  authenticate as RequestHandler, twoFASetup  as RequestHandler);
router.post('/2fa/enable', authenticate as RequestHandler, validate(twoFAEnableSchema), twoFAEnable as RequestHandler);
router.post('/2fa/verify', authenticate as RequestHandler, validate(twoFAVerifySchema), twoFAVerify as RequestHandler);

// ── Admin ─────────────────────────────────────────────────────────
router.get('/admin/users',
  authenticate as RequestHandler,
  authorize('ADMIN', 'SUPER_ADMIN') as RequestHandler,
  ((_req, res) => res.json({ message: 'Accès admin OK' })) as RequestHandler
);

export default router;
