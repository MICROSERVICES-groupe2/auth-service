# Auth Service — Plan d'Implémentation Complet

**Service :** bank-platform-auth  
**Port :** 8084  
**Base de données :** PostgreSQL + Redis  
**Langage :** Node.js 20 LTS / Express  
**Phases plan :** P2.11 → P2.15

---

## Table des Matières

1. [T1 — Initialisation](#t1--initialisation)
2. [T2 — Mécanismes d'Authentification](#t2--mécanismes-dauthentification)
3. [T3 — RBAC (Rôles et Permissions)](#t3--rbac-rôles-et-permissions)
4. [T4 — Gestion des Sessions Redis](#t4--gestion-des-sessions-redis)
5. [T5 — Tests + Dockerisation](#t5--tests--dockerisation)
6. [Ordre d'implémentation recommandé](#ordre-dimplémentation-recommandé)

---

## T1 — Initialisation

> P2.11 — Projet Node.js avec Express

- [ ] Initialiser le projet :
  ```bash
  npm init -y
  npm install express passport passport-jwt passport-local passport-google-oauth20 \
              jsonwebtoken bcrypt redis ioredis speakeasy qrcode joi \
              pg sequelize dotenv morgan helmet cors
  npm install --save-dev jest supertest nodemon eslint
  ```
- [ ] Créer la structure du projet :
  ```
  src/
  ├── app.js
  ├── server.js
  ├── models/
  │   ├── user.model.js
  │   └── permission.model.js
  ├── routes/
  │   └── auth.routes.js
  ├── controllers/
  │   └── auth.controller.js
  ├── services/
  │   ├── auth.service.js
  │   ├── token.service.js
  │   └── twofa.service.js
  ├── middlewares/
  │   ├── authenticate.js
  │   └── authorize.js
  └── config/
      ├── index.js
      ├── database.js
      └── redis.js
  ```
- [ ] Configurer `.env` :
  - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `JWT_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=7d`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
  - `PORT=8084`
- [ ] Configurer `helmet()` et `cors()` dans `app.js`
- [ ] Vérifier le démarrage : `GET http://localhost:8084/health` → `{"status":"UP"}`

---

## T2 — Mécanismes d'Authentification

> P2.12 — Login, OAuth2, 2FA, Biométrique

- [ ] **Login email/password** :
  - [ ] Hacher le password à l'inscription avec `bcrypt` (saltRounds=12)
  - [ ] Vérifier avec `bcrypt.compare()` à la connexion
  - [ ] Générer un **access token** JWT (TTL 15min) et un **refresh token** (TTL 7 jours)
  - [ ] Stocker le refresh token en base (table `refresh_tokens`)
  - [ ] Endpoints : `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`

- [ ] **OAuth2 Google** :
  - [ ] Configurer `passport-google-oauth20` Strategy
  - [ ] Créer/retrouver l'utilisateur via l'email Google
  - [ ] Générer les mêmes JWT qu'au login classique
  - [ ] Endpoints : `GET /api/auth/google`, `GET /api/auth/google/callback`

- [ ] **2FA TOTP** :
  - [ ] `POST /api/auth/2fa/setup` : générer un secret avec `speakeasy.generateSecret()`, retourner le QR code (`qrcode.toDataURL()`)
  - [ ] `POST /api/auth/2fa/verify` : valider le code 6 chiffres avec `speakeasy.totp.verify()`
  - [ ] `POST /api/auth/2fa/enable` : activer le 2FA sur le compte (stocker le secret en base, chiffré)
  - [ ] Exiger le code TOTP à chaque login si 2FA activé

- [ ] **Biométrique simulée** :
  - [ ] `POST /api/auth/biometric` : accepter un token de fingerprint, valider sa signature JWT dédiée
  - [ ] Répondre avec les mêmes tokens d'accès que le login classique

---

## T3 — RBAC (Rôles et Permissions)

> P2.13 — Contrôle d'accès basé sur les rôles

- [ ] Définir les rôles dans l'enum :
  - `CLIENT` — accès à ses propres comptes et transactions
  - `OPERATOR` — gestion des clients, validation des opérations
  - `ADMIN` — gestion des opérateurs, rapports
  - `SUPER_ADMIN` — accès total, paramétrage système

- [ ] Créer la table `users` (PostgreSQL via Sequelize) :

  | Champ | Type | Contrainte |
  |-------|------|------------|
  | `id` | UUID | PK |
  | `email` | String | UNIQUE NOT NULL |
  | `passwordHash` | String | nullable (OAuth users) |
  | `role` | Enum | CLIENT / OPERATOR / ADMIN / SUPER_ADMIN |
  | `twoFaSecret` | String | nullable, chiffré |
  | `twoFaEnabled` | Boolean | défaut false |
  | `isActive` | Boolean | défaut true |
  | `createdAt` | Date | auto |

- [ ] Créer la table `user_permissions` (permissions granulaires) :

  | Champ | Type | Description |
  |-------|------|-------------|
  | `id` | UUID | PK |
  | `userId` | UUID | FK → users |
  | `permission` | String | ex: `loans:approve`, `clients:delete` |

- [ ] Créer le middleware `authenticate.js` :
  - Vérifier le header `Authorization: Bearer <token>`
  - Valider la signature JWT avec `jsonwebtoken.verify()`
  - Vérifier que le token n'est pas blacklisté dans Redis
  - Attacher `req.user` avec l'utilisateur décodé

- [ ] Créer le middleware `authorize(...roles)` :
  - Vérifier que `req.user.role` est dans la liste des rôles autorisés
  - Retourner `403 Forbidden` si non autorisé

---

## T4 — Gestion des Sessions Redis

> P2.14 — Blacklist JWT et sessions

- [ ] Configurer la connexion Redis dans `src/config/redis.js` (via `ioredis`)
- [ ] À la **connexion** : stocker la session dans Redis avec TTL 24h :
  ```
  SET session:{userId} {sessionData} EX 86400
  ```
- [ ] À la **déconnexion** : ajouter le JWT access token à la blacklist Redis :
  ```
  SET blacklist:{tokenJti} 1 EX {token_remaining_ttl}
  ```
- [ ] Dans le middleware `authenticate.js` : vérifier que `blacklist:{jti}` n'existe pas dans Redis avant de valider le token
- [ ] Endpoint `POST /api/auth/logout/all` : invalider toutes les sessions d'un utilisateur (supprimer la session Redis)
- [ ] Gérer la reconnexion Redis automatique en cas de coupure

---

## T5 — Tests + Dockerisation

> P2.15

- [ ] **Tests Jest + Supertest** :
  - [ ] `auth.test.js` — register / login / logout complet
  - [ ] `token.test.js` — génération, validation, expiration, refresh
  - [ ] `twofa.test.js` — setup, vérification code TOTP valide et invalide
  - [ ] `rbac.test.js` — middleware authorize avec chaque rôle
  - [ ] `blacklist.test.js` — token blacklisté est rejeté
  - [ ] Mock Redis et PostgreSQL pour les tests unitaires

- [ ] **Dockerisation** :
  - [ ] `docker/Dockerfile` :
    ```dockerfile
    FROM node:20-alpine
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci --only=production
    COPY src/ ./src/
    EXPOSE 8084
    CMD ["node", "src/server.js"]
    ```
  - [ ] `docker/docker-compose.yml` : auth-service + postgres-auth + redis
  - [ ] Tester : `docker compose up` → `GET http://localhost:8084/health`

---

## Ordre d'implémentation recommandé

| # | Tâche | Dépendance | Durée estimée |
|---|-------|------------|---------------|
| 1 | T1 — Initialisation + config | — | 1h |
| 2 | T3 — Modèles DB (users, permissions) | T1 | 1h30 |
| 3 | T2 — Login email/password + JWT | T3 | 2h |
| 4 | T4 — Sessions Redis + blacklist | T2 | 1h30 |
| 5 | T3 — Middlewares authenticate + authorize | T2, T4 | 1h30 |
| 6 | T2 — OAuth2 Google | T3 | 2h |
| 7 | T2 — 2FA TOTP | T3 | 2h |
| 8 | T2 — Biométrique simulée | T2 | 1h |
| 9 | T5 — Tests | Tout | 3h |
| 10 | T5 — Dockerisation | Tout | 1h |

**Durée totale estimée : 4–5 jours** (conforme plan P2.11 → P2.15)

---

## Critères de validation production

- [ ] Login email/password retourne access token (15min) + refresh token (7j)
- [ ] Refresh token renouvelle l'access token sans re-login
- [ ] Logout ajoute le JWT à la blacklist Redis
- [ ] Token blacklisté est rejeté avec 401
- [ ] 2FA TOTP : QR code généré, code validé correctement
- [ ] Middleware `authorize` retourne 403 si rôle insuffisant
- [ ] Passwords ne sont jamais stockés en clair (bcrypt)
- [ ] `GET /health` retourne `{"status":"UP"}`
- [ ] `docker compose up` démarre sans erreur
- [ ] Aucun secret en clair dans le code
