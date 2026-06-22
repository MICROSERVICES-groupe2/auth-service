import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import './config/passport';
import authRoutes from './routes/auth.routes';

const app = express();

// -------------------------------------------------
//  HTTPS‑enforcement (disabled in dev)
// -------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  // Trust the proxy if behind a reverse‑proxy (e.g., nginx, Fly.io)
  app.enable('trust proxy');

  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      return next();
    }
    // Redirect to HTTPS
    res.redirect(`https://${req.headers.host}${req.url}`);
  });
}


// ── Sécurité ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Trop de requêtes, réessayez plus tard' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Plus strict sur login/register
  message: { error: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives, réessayez dans 15 minutes' },
});

app.use(limiter);

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Passport ──────────────────────────────────────────────────────
app.use(passport.initialize());

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'bank-platform-auth',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth',          authRoutes);

// ── 404 ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route introuvable' });
});

// ── Erreurs globales ──────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Erreur non gérée :', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' });
});

export default app;