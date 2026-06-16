# bank-platform-auth

Service d'authentification pour la plateforme bancaire distribuée.

## Technologies
- Node.js 20 LTS
- Express
- Passport.js (JWT, Google OAuth2)
- bcrypt
- speakeasy (2FA TOTP)
- Redis (sessions / blacklist)
- PostgreSQL
- TypeScript

## Port
`8084`

## Structure
- `src/` - Code source
- `tests/` - Tests Jest + Supertest
- `docker/` - Dockerfile et docker-compose
- `docs/` - Documentation

---

## Démarrage

### 1. Cloner le repo
```bash
git clone https://github.com/MICROSERVICES-groupe2/auth-service.git
cd auth-service
```

### 2. Créer le fichier .env
Le fichier `.env` n'est pas inclus dans le repo pour des raisons de sécurité.
Créez-le manuellement à la racine du projet :

```bash
# Copiez le fichier exemple
cp .env.example .env
```

Ou créez le fichier `.env` manuellement avec ce contenu :

```env
PORT=8084
DATABASE_URL=postgresql://user:password@localhost:5434/auth_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=jwt_secret_very_long_and_secure_change_in_prod
JWT_REFRESH_SECRET=jwt_refresh_secret_very_long_and_secure_change_in_prod
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8084/api/auth/google/callback
BCRYPT_SALT_ROUNDS=12
```

> **Note** : Les variables `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont
> optionnelles. Le service fonctionne sans elles. Pour les obtenir, créez un
> projet sur https://console.cloud.google.com

### 3. Démarrer avec Docker
```bash
docker compose -f docker/docker-compose.yml up --build
```

### 4. Vérifier que tout tourne
```bash
GET http://localhost:8084/health
```
Réponse attendue :
```json
{"status":"UP","service":"bank-platform-auth"}
```

---

## Endpoints

### Publics
| Méthode | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Créer un compte |
| POST | /api/auth/login | Se connecter |
| POST | /api/auth/refresh | Renouveler le token |
| POST | /api/auth/biometric | Login biométrique simulé |
| GET | /api/auth/google | Login Google OAuth |

### Protégés (Bearer Token requis)
| Méthode | Endpoint | Description |
|---|---|---|
| GET | /api/auth/me | Profil utilisateur connecté |
| POST | /api/auth/logout | Se déconnecter |
| POST | /api/auth/logout/all | Déconnecter toutes les sessions |
| POST | /api/auth/2fa/setup | Générer secret + QR code 2FA |
| POST | /api/auth/2fa/enable | Activer le 2FA |
| POST | /api/auth/2fa/verify | Vérifier un code 2FA |

### Admin uniquement
| Méthode | Endpoint | Rôles autorisés |
|---|---|---|
| GET | /api/auth/admin/users | ADMIN, SUPER_ADMIN |

---

## Exemples Postman

### Register
```json
POST /api/auth/register
{
  "email": "user@bank.com",
  "password": "password123",
  "role": "CLIENT"
}
```
Rôles disponibles : `CLIENT`, `OPERATOR`, `ADMIN`, `SUPER_ADMIN`

### Login
```json
POST /api/auth/login
{
  "email": "user@bank.com",
  "password": "password123"
}
```

### Login avec 2FA activé
```json
POST /api/auth/login
{
  "email": "user@bank.com",
  "password": "password123",
  "totpCode": "123456"
}
```

### Activer le 2FA
Étape 1 — Générer le secret :
POST /api/auth/2fa/setup

Authorization: Bearer eyJ...


Étape 2 — Sur votre téléphone :
- Installez **Google Authenticator**
- Appuyez **+** → **Saisir une clé**
- Entrez le `secret` reçu dans la réponse

Étape 3 — Activer :
```json
POST /api/auth/2fa/enable
Authorization: Bearer eyJ...
{
  "secret": "SECRET_RECU",
  "token": "CODE_6_CHIFFRES"
}
```

---

## Fonctionnalités implémentées
- Inscription et login email/password (bcrypt saltRounds=12)
- JWT accessToken (15min) + refreshToken (7j) avec rotation
- Authentification à deux facteurs TOTP (Google Authenticator)
- RBAC : CLIENT, OPERATOR, ADMIN, SUPER_ADMIN
- Blacklist des tokens à la déconnexion (Redis)
- Sessions Redis (TTL 24h)
- Google OAuth2 (configuré, nécessite credentials Google Cloud)
- Rate limiting sur login/register
- Validation des entrées avec Joi
- Helmet + CORS pour la sécurité HTTP