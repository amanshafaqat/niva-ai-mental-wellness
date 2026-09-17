# NIVA — AI Mental Wellness Companion
> *"Someone to talk to."*  
> **Phase 3: AI Conversation Engine + Text Wellness Sessions**

---

## 1. What NIVA Is

**NIVA** is a privacy-conscious AI mental wellness companion designed for diverse generations—including students, working adults, and senior citizens. NIVA offers a calm, empathetic, and confidential conversational space for emotional grounding, stress alleviation, and daily mindfulness check-ins.

### Critical Safety & Clinical Disclaimer
NIVA is **NOT** a licensed psychiatrist, clinical psychologist, medical doctor, or a replacement for professional clinical care. NIVA never provides medical diagnoses, pharmacological advice, or instructions facilitating self-harm or violence. If a user is experiencing an acute mental health crisis, NIVA directs them to professional human crisis intervention (such as the **988 Suicide & Crisis Lifeline** in the United States and Canada).

---

## 2. Current Status: Phase 3 AI Conversation Engine + Text Wellness Sessions

This repository reflects **Phase 3: AI Conversation Engine + Text Wellness Sessions**, successfully delivering NIVA's core text conversation capabilities on top of Phase 1, Phase 2, and Phase 2.1 identity and security foundations.

### Phase 3 Core Accomplishments
1. **AI Model Integration (Gemini 3.8 Flash)**:
   - Powered by Google's latest `gemini-3.8-flash` model via the modern `@google/genai` TypeScript SDK.
   - All API keys (`GEMINI_API_KEY`) remain strictly server-side; client browsers never see or handle AI credentials.
   - Decoupled via `AIProvider` abstraction (`GeminiAIProviderService`), enabling graceful degradation and extensibility.

2. **NIVA Personality & Conversational Philosophy**:
   - **Listens more than it talks**: Default responses are SHORT (normally 1–3 concise, conversational sentences).
   - Warm, calm, empathetic, patient, non-judgmental, and accessible across ages and backgrounds.
   - Never lectures, provides unsolicited multi-paragraph manuals, or creates emotional dependency.

3. **User Preferences**:
   - Configurable response style: `SHORT` (1–2 sentences), `BALANCED` (2–3 sentences), or `DETAILED` (3–5 sentences).
   - Configurable conversational preference: `JUST_LISTEN` (empathy without unsolicited advice), `LISTEN_AND_RESPOND` (validation + gentle follow-up question), or `HELP_ME_SOLVE` (empathy + one practical grounding step).
   - Stored in the database (`UserPreferences` model) with defaults: `responseStyle: "SHORT"`, `conversationPreference: "LISTEN_AND_RESPOND"`.

4. **Wellness Session Lifecycle & Strict Ownership**:
   - Start session (`POST /conversations` or `/api/conversations`).
   - List sessions (`GET /conversations` or `/api/conversations`).
   - Get session (`GET /conversations/:id` or `/api/conversations/:id`).
   - Post message & receive NIVA reply (`POST /conversations/:id/messages`).
   - End session (`POST /conversations/:id/end`).
   - **Zero Cross-User Leakage**: Users can only access their own sessions; unauthorized access attempts are strictly blocked with `403 Forbidden`.

5. **Safety Guardrails & Rate Limiting**:
   - Pre-prompt safety evaluation detects severe harm/suicide triggers and redirects to real human emergency support (988).
   - User rate limiting prevents runaway loops or abuse (20 messages per minute per user).
   - In-memory and database usage metrics track conversations, messages, and AI requests.

6. **Database Schema (Prisma)**:
   - `UserPreferences`: User-specific response style and conversational modes.
   - `Conversation`: Wellness sessions with `title`, `status` (`ACTIVE` | `ENDED`), and timestamps.
   - `ConversationMessage`: Ordered transcript records (`role`: `user` | `assistant` | `system`).
   - Migration `20260915120000_phase3_conversations_and_preferences` included.

---

## 3. Prior Phases Foundation

### Phase 2 & 2.1 Security & RBAC Hardening
1. **Cryptographic Google OAuth State Validation (CSRF & Replay Defense)**:
   - High-entropy 256-bit state values (`crypto.randomBytes(32).toString('hex')`) generated at OAuth initiation.
   - Associated with an `HttpOnly`, `SameSite=Lax`, short-lived (10-minute) `niva_oauth_state` cookie.
   - Callback endpoints enforce strict state validation and timing-safe comparison.
2. **Session & Cookie Security**:
   - Sessions are identified by high-entropy random identifiers (`niva_sess_*`).
   - Transmitted exclusively over `HttpOnly`, `SameSite=Lax` cookies.
   - `GET /auth/me` returns sanitized user profiles: zero secrets or token credentials.
   - `POST /auth/logout` invalidates the server session record and clears client cookies.
3. **RBAC Guard Enforcement & Anti-Escalation Boundaries**:
   - Roles: `USER` (default), `GUARDIAN`, `ADMIN`.
   - `PATCH /users/me/role` strictly rejects self-assigned role changes with `403 Forbidden` and records security audit events (`ROLE_CHANGE_REJECTED`).
   - `AdminGuard` and `GuardianGuard` block unauthorized requests deterministically.

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

## 13. How to Run Tests & Verification

NIVA includes automated security verification scripts and unit test suites:

```bash
# 1. Run Phase 2.1 Security Hardening Automated Verification (Root)
npx tsx scripts/verify-phase-2-1.ts

# 2. Run NestJS Backend Unit & RBAC Tests
cd backend
npm test

# Run specific test suites:
npm test -- auth.service.spec.ts   # Google OAuth, state verification, session handling
npm test -- rbac-guards.spec.ts    # UserGuard, GuardianGuard, AdminGuard
npm test -- health.controller.spec.ts
```

---

## 14. Security & Cybersecurity Notes

As a cybersecurity portfolio project, NIVA implements defense-in-depth principles from day one:
1. **Zero Plaintext Passwords**: Authentication is strictly federated via Google Identity Services. Password cracking and credential stuffing attack vectors are eliminated.
2. **Strict CSRF & Replay Defense**: OAuth flows generate 256-bit cryptographic state tokens validated via `crypto.timingSafeEqual` and destroyed immediately after single use.
3. **No Fake User Fallbacks**: Database errors are safely logged and return server error responses. The backend never fabricates mock or demo sessions on failure.
4. **Token Minimization**: Third-party OAuth tokens (`accessToken`, `refreshToken`, `idToken`) are discarded immediately after user claims verification; they are never stored in the database.
5. **Server-Enforced RBAC & Anti-Escalation**: Client-side role badges are decorative only. `RolesGuard` independently verifies permissions. The backend explicitly rejects and logs attempts to modify user roles via `PATCH /users/me/role`.
6. **No Unrestricted Admin Browsing**: Administrators **CANNOT** view user conversations. Future access models require cryptographic, time-bounded, audit-logged consent.
7. **Sanitized Exception Handling**: Database constraints, query internals, and stack traces are never leaked to external callers.
8. **Automated Audit Log Redaction**: Authentication and authorization events are audited with automatic redaction of secrets, tokens, API keys, and conversational message contents.

---

## 15. Production Readiness Status

| Subsystem | Readiness | Notes |
| :--- | :--- | :--- |
| **Authentication Core** | Production-Hardened | Real Google OAuth 2.0 flow, 256-bit CSRF state, single-use state cookie, timing-safe checks |
| **Session Security** | Production-Hardened | High-entropy server sessions, `HttpOnly`, `SameSite=Lax`, strict database backing |
| **RBAC Boundaries** | Production-Hardened | Strict role checks (`USER`, `GUARDIAN`, `ADMIN`), explicit role change blocking |
| **Audit Logging** | Production-Hardened | Immutable security events, automatic redaction of sensitive credentials and prompts |
| **Database Layer** | Production-Hardened | Prisma PostgreSQL schema, migrations applied, Token Minimization implemented |
| **AI Conversation Engine** | Deferred (Phase 2.2/3) | Interfaces defined; live model attachments scheduled |
| **Voice Pipelines** | Deferred (Phase 3) | Realtime WebSockets / WebRTC scheduled |

---

## Packaging & Download

To generate a clean ZIP archive of this complete Phase 2 project excluding `node_modules`, build artifacts, and secrets:

```bash
npm run package
```

The output file `niva-phase-2.zip` will be generated in the root directory. You can also download it directly from the live preview via the **"Download Phase 2 ZIP"** button or the `GET /api/download-zip` endpoint.
