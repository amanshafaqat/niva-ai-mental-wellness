# NIVA — AI Mental Wellness Companion
> *"Someone to talk to."*  
> **Phase 4.1: Unified Architecture & Canonical Realtime Voice Engine**

---

## 1. What NIVA Is

**NIVA** is a privacy-conscious AI mental wellness companion designed for diverse generations—including students, working adults, and senior citizens. NIVA offers a calm, empathetic, and confidential conversational space for emotional grounding, stress alleviation, daily mindfulness check-ins, and native bidirectional audio conversations.

### Critical Safety & Clinical Disclaimer
NIVA is **NOT** a licensed psychiatrist, clinical psychologist, medical doctor, or a replacement for professional clinical care. NIVA never provides medical diagnoses, pharmacological advice, or instructions facilitating self-harm or violence. If a user is experiencing an acute mental health crisis, NIVA directs them to professional human crisis intervention and international crisis lifelines (such as calling local emergency services or visiting findahelpline.com).

---

## 2. Canonical Architecture & Runtime (Phase 4.1)

In Phase 4.1, NIVA's architecture was unified into **one canonical, production-ready full-stack application**:

```
                         ┌──────────────────────────────────────────┐
                         │   Root Vite + React SPA Frontend         │
                         │   (Tailwind CSS v4, Lucide, Motion)      │
                         │   - index.html & src/App.tsx             │
                         │   - Dedicated VoiceSessionScreen         │
                         │   - 16kHz PCM Audio Resampler & Mic      │
                         └────────────────────┬─────────────────────┘
                                              │ HTTP & WebSocket (/live)
                                              ▼
                         ┌──────────────────────────────────────────┐
                         │   Express Full-Stack Server (server.ts)  │
                         │   - Vite Middleware (development)        │
                         │   - Static File Serving (production)     │
                         │   - Google OAuth & AuthSession Cookies   │
                         │   - Realtime WebSocket Relay (/live)     │
                         └──────┬─────────────┬──────────────┬──────┘
                                │             │              │
                                ▼             ▼              ▼
     ┌────────────────────────────┐  ┌─────────────────┐  ┌───────────────────┐
     │ Gemini Live Native Audio   │  │  Prisma ORM     │  │ Security & RBAC   │
     │ Model: gemini-3.8-live     │  │  PostgreSQL     │  │ - Ephemeral Voice │
     │ - 16kHz PCM In / 24kHz Out │  │  VoiceSession   │  │   Tickets (60s)   │
     │ - Instant Barge-in Interr. │  │  (Source of     │  │ - Server-Only Key │
     │ - Empathetic Voice Pacing  │  │   Truth)        │  │ - Audit Logging   │
     └────────────────────────────┘  └─────────────────┘  └───────────────────┘
```

- **Canonical Frontend**: Root Vite + React application (`index.html`, `src/App.tsx`, `vite.config.ts`, `server.ts`).
- **Deprecated Architecture Removed**: The obsolete `frontend/` (Next.js) directory has been decommissioned in favor of the canonical root full-stack architecture.
- **Preview Resilience**: The application loads gracefully in AI Studio preview even if optional external credentials (e.g. Gemini API key, Google OAuth, PostgreSQL) are absent or in-memory.

---

## 3. Realtime Voice Engine (Phase 4.1 Highlights)

1. **Google Live API Model (`gemini-3.8-live`)**:
   - Uses Google's canonical `gemini-3.8-live` model for bidirectional low-latency native audio streaming.
   - Paced with the soothing `Zephyr` prebuilt voice config for calm, empathetic vocal cadence.

2. **Strict Canonical Voice Connection State Model**:
   - Both frontend and backend share the canonical `VoiceConnectionState` type:
     - `DISCONNECTED`: Initial idle state before session starts.
     - `REQUESTING_MIC`: Requesting browser microphone permissions.
     - `CONNECTING`: Authenticating voice ticket and establishing WebSocket connection.
     - `LISTENING`: User turn; microphone capture active and streaming.
     - `SPEAKING`: NIVA turn; native audio playing through Web Audio API.
     - `MUTED`: User microphone manually muted.
     - `ENDED`: Voice session gracefully closed.
     - `ERROR`: Controlled connection or permission error reported truthfully.

3. **Audio Quality & Resampling**:
   - Client-side linear interpolation resampling in `src/utils/audio-pcm.ts` ensures microphone input is converted from hardware rates (44.1kHz or 48kHz) to exactly 16,000 Hz 16-bit linear PCM before base64 encoding.
   - 24,000 Hz native audio output playback through scheduled `AudioBufferSourceNode`s.

4. **Genuine Barge-In / Interruption**:
   - Client detects user speech while NIVA speaks (RMS threshold > 0.04) or on manual interrupt button click.
   - Stops queued audio playback immediately without audio stutter or overlap.
   - Notifies backend and Gemini Live session, increments interruption metrics, and seamlessly transitions to `LISTENING`.

5. **Security & Ticket-Based Authentication**:
   - `GEMINI_API_KEY` is strictly held on the server and is never exposed to browser dev tools or network payloads.
   - Authenticated users request short-lived (60-second) single-use voice tickets via `POST /api/conversations/:id/voice-ticket`.
   - Tickets are generated with 256-bit cryptographic entropy (`crypto.randomBytes(16)`), validated against user ownership, and invalidated immediately upon first use.

6. **Database Persistence with Prisma**:
   - `VoiceSession` model in `prisma/schema.prisma` serves as the persistent source of truth with `id`, `userId`, `conversationId`, `status`, `startedAt`, `endedAt`, and `durationSeconds`.
   - Migration `20260917150000_phase4_voice_sessions` ensures database schema integrity.

7. **International Safety & Ethical Guardrails**:
   - Crisis safety guidance is neutral and international (referencing emergency services and findahelpline.com).
   - Truthful error reporting: If credentials are missing, NIVA never fabricates fake AI responses.

---

## 4. Repository Structure

```
niva-project/
├── index.html                     # Vite entry point with synchronized metadata
├── metadata.json                  # AI Studio metadata & microphone permissions
├── package.json                   # Monorepo dependencies & build scripts
├── prisma/
│   ├── schema.prisma              # Canonical Prisma schema (User, Conversation, VoiceSession)
│   └── migrations/                # Versioned SQL migrations
├── scripts/
│   └── package-project.ts         # Generates niva-phase-4.1-final.zip
├── server.ts                      # Express server + Vite middleware + /live WebSocket relay
├── shared/
│   ├── constants/                 # Shared role constants
│   └── types/                     # Canonical cross-stack TypeScript types
│       ├── auth.ts                # AuthSession, User
│       ├── conversation.ts        # Conversation, Message, Preferences DTOs
│       └── voice.ts               # VoiceConnectionState, VoiceTicket, VoiceMessages
├── src/
│   ├── components/                # Canonical React UI components
│   │   ├── ArchitectureViewer.tsx # Architecture inspection component
│   │   ├── AuditLogViewer.tsx     # Security audit trail viewer
│   │   ├── DashboardView.tsx      # User profile & session overview
│   │   ├── DisclaimerBanner.tsx   # Healthcare safety disclaimer
│   │   ├── GoogleSignInModal.tsx  # Authentication modal
│   │   ├── HeroSection.tsx        # Calming entry hero
│   │   ├── Navbar.tsx             # Main header & session status
│   │   ├── RoleTester.tsx         # RBAC verification tester
│   │   ├── SystemHealthWidget.tsx # Live API & DB health monitor
│   │   ├── VoiceSessionScreen.tsx # Dedicated realtime voice presence
│   │   └── WellnessChatSession.tsx# Text-based wellness conversations
│   ├── lib/
│   │   ├── api.ts                 # REST API client
│   │   ├── auth-context.tsx       # Authentication state context
│   │   └── prisma.ts              # PrismaClient singleton with connectivity check
│   ├── services/
│   │   ├── conversation-engine.ts # Text conversation & safety evaluation
│   │   └── voice-engine.ts        # Gemini Live relay & VoiceSession persistence
│   ├── utils/
│   │   └── audio-pcm.ts           # 16kHz resampling & PCM encoding/decoding
│   ├── App.tsx                    # Main React application entry
│   ├── main.tsx                   # React DOM root render
│   └── index.css                  # Global Tailwind CSS styles
├── tsconfig.json                  # Canonical TypeScript configuration
└── vite.config.ts                 # Vite bundler configuration
```

---

## 5. Development & Running

### Starting Development Server
```bash
npm run dev
```
Starts Express on port 3000 with Vite middleware handling asset bundling, live reload, and WebSocket voice relay at `ws://localhost:3000/live`.

### Type Checking & Linting
```bash
npm run lint
```

### Production Build
```bash
npm run build
npm start
```

### Generating Final ZIP Package
```bash
npm run package
```
Generates `niva-phase-4.1-final.zip` (clean archive excluding `node_modules`, `.git`, build outputs, and credentials).
