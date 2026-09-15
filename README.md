# NIVA — AI Mental Wellness Companion
> *"Someone to talk to."*  
> **Phase 1 Architecture & Security Foundation**

---

## 1. What NIVA Is

**NIVA** is a privacy-conscious AI mental wellness companion designed for diverse generations—including students, working adults, and senior citizens. NIVA offers a calm, empathetic, and confidential conversational space for emotional grounding, stress alleviation, and daily mindfulness check-ins.

### Critical Safety & Clinical Disclaimer
NIVA is **NOT** a licensed psychiatrist, clinical psychologist, medical doctor, or a replacement for professional clinical care. NIVA never provides medical diagnoses, pharmacological advice, or instructions facilitating self-harm or violence. If a user is experiencing an acute mental health crisis, NIVA directs them to professional human crisis intervention (such as the **988 Suicide & Crisis Lifeline** in the United States and Canada).

---

## 2. Current Phase: Phase 1

This repository represents **Phase 1: Architecture, Security, & Monorepo Foundation**.

### Phase 1 Directives
- Establish clean, extensible full-stack monorepo separation (`/frontend`, `/backend`, `/prisma`, `/shared`).
- Implement the three-role architecture: `USER`, `GUARDIAN`, `ADMIN`.
- Implement Google OAuth 2.0 authentication architecture with cryptographically secure session management.
- Implement server-side Role-Based Access Control (RBAC) via NestJS `RolesGuard`.
- Implement the Prisma PostgreSQL database schema with relationships and future extension points.
- Implement a decoupled, vendor-agnostic `AIProvider` abstraction interface.
- Establish an immutable security audit logging foundation.
- Implement a robust `GET /health` endpoint.
- **Strictly deferred to future phases:** Realtime voice-to-voice models, AI conversation generation engines, raw dialogue persistence, and administrative browsing of private chats.

---

## 3. Architecture

NIVA follows a decoupled, privacy-first, full-stack architecture:

```
                          ┌──────────────────────────┐
                          │   Next.js 14 Frontend    │
                          │ (Tailwind, Lucide, Calm) │
                          └─────────────┬────────────┘
                                        │  Bearer Session Token
                                        ▼
                          ┌──────────────────────────┐
                          │   NestJS REST Backend    │
                          │   - Helmet & CORS        │
                          │   - RolesGuard (RBAC)    │
                          │   - Global Exception     │
                          └──────┬────────────┬──────┘
                                 │            │
             ┌───────────────────┴──┐      ┌──┴───────────────────┐
             │                      │      │                      │
             ▼                      ▼      ▼                      ▼
    ┌─────────────────┐    ┌─────────────┐ ┌───────────────┐ ┌───────────────┐
    │  Google OAuth   │    │ Prisma ORM  │ │ Audit Logger  │ │  AIProvider   │
    │ Identity Server │    │ (PostgreSQL)│ │  (Security)   │ │  Abstraction │
    └─────────────────┘    └─────────────┘ └───────────────┘ └───────────────┘
```

1. **Client Identity**: The frontend authenticates exclusively using Google OAuth 2.0. No plaintext passwords or email verification pins are ever used.
2. **Session Verification**: The backend issues high-entropy cryptographically generated session tokens (`niva_sess_*`).
3. **RBAC Guard**: NestJS `@Roles(...)` metadata is evaluated on every protected request by `RolesGuard`.
4. **Audit Trail**: Sensitive actions (logins, logouts, RBAC rejections) generate immutable `AuditLog` records.
5. **AI Abstraction**: Core services interface with an abstract `AIProvider`, isolating NIVA from third-party vendor lock-in.

---

## 4. Tech Stack

- **Frontend**: Next.js (React 18/19), TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: NestJS, Express, TypeScript, class-validator, class-transformer.
- **Database**: PostgreSQL 14+, Prisma ORM.
- **Authentication**: Google OAuth 2.0 (Google Identity Services) + cryptographically secure session tokens.
- **Security & Infrastructure**: Helmet, NestJS Throttler/Rate-limiting, CORS, strictly native Node.js (no Docker or Docker Compose required).

---

## 5. Folder Structure

```
niva-project/
├── backend/                       # NestJS REST API Backend
│   ├── src/
│   │   ├── ai/                    # Vendor-agnostic AI Provider Abstraction
│   │   │   ├── abstracts/         # BaseAIProvider abstract class
│   │   │   ├── interfaces/        # AIProvider, AIMessage, SafetyEvaluation
│   │   │   ├── providers/         # Stub provider (Phase 1 placeholder)
│   │   │   ├── ai-provider.factory.ts
│   │   │   └── ai.module.ts
│   │   ├── audit/                 # Security Audit Logging Module
│   │   │   ├── audit.controller.ts# Protected GET /audit/logs (ADMIN only)
│   │   │   ├── audit.service.ts   # Immutable audit trail logger
│   │   │   └── audit.module.ts
│   │   ├── auth/                  # Google OAuth & Session Management
│   │   │   ├── dto/               # GoogleVerifyTokenDto, SessionDto
│   │   │   ├── guards/            # SessionAuthGuard
│   │   │   ├── auth.controller.ts # OAuth verify, session info, logout
│   │   │   ├── auth.service.ts    # User creation, session generation
│   │   │   └── auth.module.ts
│   │   ├── authorization/         # Role-Based Access Control (RBAC)
│   │   │   ├── roles.decorator.ts # @Roles() metadata decorator
│   │   │   ├── roles.guard.ts     # NestJS CanActivate RBAC guard
│   │   │   └── authorization.module.ts
│   │   ├── common/                # Shared Filters, Interceptors, DTOs
│   │   │   ├── filters/           # HttpExceptionFilter (sanitized errors)
│   │   │   └── dto/               # ApiResponseDto
│   │   ├── health/                # System Health Monitoring
│   │   │   ├── health.controller.ts# GET /health
│   │   │   └── health.service.ts
│   │   ├── prisma/                # PrismaClient Lifecycle Integration
│   │   │   ├── prisma.service.ts
│   │   │   └── prisma.module.ts
│   │   ├── users/                 # User Profile & Directory Management
│   │   │   ├── users.controller.ts# /users/me, guardian & admin test routes
│   │   │   └── users.service.ts
│   │   ├── app.module.ts          # Root NestJS Module
│   │   └── main.ts                # NestJS Application Bootstrap
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
├── frontend/                      # Next.js Modern Responsive UI
│   ├── src/
│   │   ├── app/                   # Next.js Layout & Page Routing
│   │   ├── components/            # Accessible, Calm Wellness Components
│   │   │   ├── ArchitectureViewer.tsx
│   │   │   ├── AuditLogViewer.tsx
│   │   │   ├── DashboardView.tsx
│   │   │   ├── DisclaimerBanner.tsx
│   │   │   ├── DownloadZipModal.tsx
│   │   │   ├── GoogleSignInModal.tsx
│   │   │   ├── HeroSection.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── RoleTester.tsx
│   │   │   └── SystemHealthWidget.tsx
│   │   ├── lib/
│   │   │   ├── api.ts             # REST client wrapper
│   │   │   └── auth-context.tsx   # React AuthContext & session state
│   │   └── types.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
├── prisma/                        # Database Architecture & Migrations
│   ├── schema.prisma              # User, Account, Session, AuditLog models
│   ├── seed.ts                    # Server admin seed script
│   └── migrations/                # Versioned SQL migration files
├── shared/                        # Shared Cross-Platform Types & Constants
│   ├── constants/roles.ts         # Role enum & permission definitions
│   ├── types/ai.ts                # AIProvider interface contract
│   ├── types/audit.ts             # AuditAction enum & entry definitions
│   ├── types/auth.ts              # AuthSession & Google payload definitions
│   └── types/user.ts              # User entity & profile interfaces
├── scripts/
│   └── package-project.ts         # Generates complete niva-phase-1.zip
├── .env.example                   # Root environment template
├── package.json                   # Root orchestrator & dev server scripts
├── README.md                      # Comprehensive Architecture Documentation
└── server.ts                      # Full-stack dev runner & API proxy
```

---

## 6. Prerequisites

To run NIVA natively on your local development machine:
- **Node.js**: v18.18.0 or v20.x+
- **npm**: v9+ (or `pnpm` / `yarn`)
- **PostgreSQL**: v14, v15, or v16 running locally or via a cloud provider.

---

## 7. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/niva_wellness?schema=public` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `your-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret | `GOCSPX-your-secret` |
| `GOOGLE_CALLBACK_URL` | OAuth redirect callback URL | `http://localhost:3000/api/auth/google/callback` |
| `JWT_SECRET` | 32+ char secret for tokens | `a-very-secure-random-32-char-string` |
| `SESSION_SECRET` | 32+ char secret for sessions | `another-secure-random-32-char-string` |
| `PORT` | Web server listening port | `3000` |
| `INITIAL_ADMIN_EMAIL`| Server-side elevated admin | `admin@niva.internal` |

---

## 8. PostgreSQL Setup

1. Start your local PostgreSQL service:
   ```bash
   # macOS (Homebrew)
   brew services start postgresql@15

   # Linux (Ubuntu/Debian)
   sudo systemctl start postgresql
   ```
2. Create the `niva_wellness` database:
   ```sql
   CREATE DATABASE niva_wellness;
   ```
3. Update `DATABASE_URL` in `.env` to match your local credentials.

---

## 9. Google OAuth Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project named **NIVA Mental Wellness**.
3. Configure the **OAuth Consent Screen**:
   - User Type: External.
   - App Name: NIVA.
   - Scopes: `openid`, `email`, `profile`.
4. Create **Credentials** -> **OAuth 2.0 Client IDs**:
   - Application Type: Web Application.
   - Authorized JavaScript Origins: `http://localhost:3000`.
   - Authorized Redirect URIs: `http://localhost:3000/api/auth/google/callback`.
5. Copy the Client ID and Secret into your `.env` file.

*Note: In development, NIVA includes an interactive verification suite with test personas so you can evaluate the session and RBAC logic even before configuring Google Cloud credentials.*

---

## 10. How to Run Frontend

To run the Next.js frontend standalone:
```bash
cd frontend
npm install
npm run dev
```
The frontend will start at `http://localhost:3000`.

---

## 11. How to Run Backend

To run the NestJS backend standalone:
```bash
cd backend
npm install
npm run start:dev
```
The NestJS server will start on port `3001` (or specified `PORT`), exposing `GET /health` and `/api/*`.

---

## 12. How to Run Database Migrations

1. Generate Prisma Client:
   ```bash
   npx prisma generate
   ```
2. Run migrations against your PostgreSQL instance:
   ```bash
   npx prisma migrate dev --name init
   ```
3. Seed the initial platform administrator:
   ```bash
   npx tsx prisma/seed.ts
   ```

---

## 13. How to Run Tests

NIVA includes unit and RBAC protection test suites:

```bash
# Run backend tests
cd backend
npm test

# Run health check controller tests
npm test -- health.controller.spec.ts

# Run RBAC RolesGuard authorization tests
npm test -- roles.guard.spec.ts

# Run Google OAuth service tests
npm test -- auth.service.spec.ts
```

---

## 14. Security & Cybersecurity Notes

As a cybersecurity portfolio project, NIVA implements defense-in-depth principles from day one:
1. **Zero Plaintext Passwords**: Authentication is strictly federated via Google Identity Services. Password cracking and credential stuffing attack vectors are eliminated.
2. **Server-Enforced RBAC**: Client-side role badges are decorative only. The backend `RolesGuard` independently verifies user identity and permissions via secure server sessions.
3. **No Unrestricted Admin Browsing**: Administrators **CANNOT** view user conversations. Future access models require cryptographic, time-bounded, audit-logged consent.
4. **Sanitized Exception Filter**: NestJS `HttpExceptionFilter` intercepts all runtime errors, masking SQL queries, database constraints, and stack traces from external consumers.
5. **Immutable Audit Trail**: All authentication events, permission checks, and administrative queries are logged with timestamps, IP addresses, and user agents.

---

## 15. What is NOT Implemented Yet

In strict compliance with Phase 1 boundaries:
- **No Realtime Voice Streaming**: WebRTC/WebSocket audio pipelines are scheduled for Phase 3.
- **No Live AI Conversational Engine**: Model text generation is scheduled for Phase 2.
- **No Direct Guardian View of Raw Transcripts**: Intentionally prohibited to preserve user privacy.
- **No Full Administrative Control Panel**: Only telemetry and audit log queries exist in Phase 1.
- **No Fake / Hallucinated AI Responses**: The `StubAIProviderService` transparently indicates that model attachment begins in Phase 2.

---

## 16. What Phase 2 Will Implement

Phase 2 will build directly upon this foundation:
1. **AI Conversation Engine**: Connect real model providers (Gemini 2.5/Flash, Claude, or local LLMs) via the `AIProvider` abstraction.
2. **Safety & Crisis Risk Classifier**: Multi-stage classification for emotional distress, self-harm signals, and violence triggers.
3. **Conversational Dialogue Storage**: Encrypted `Conversation` and `ConversationMessage` Prisma models with strict ownership policies.
4. **User Emotional Baseline & Tone Controls**: User-customizable conversation style (gentle, concise, reflective, structured).
5. **Consent Management System**: Explicit, revocable user consent protocols for guardian safety notifications.

---

## Packaging & Download

To generate a clean ZIP archive of this complete Phase 1 project excluding `node_modules` and secrets:

```bash
npm run package
```

The output file `niva-phase-1.zip` will be generated in the root directory. You can also download it directly from the live preview via the **"Download Phase 1 ZIP"** button or the `GET /api/download-zip` endpoint.
