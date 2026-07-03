# CLAUDE.md

## What this is
Realm of Allania — a web-based Play-by-Post (PbP) roleplaying platform (interactive world map, forum threads, character roster, a Codex/wiki, real-time chat) built on Next.js + Firebase.

## Stack
- **Framework**: Next.js 16 (App Router), React 19 — JavaScript (ES6+), no TypeScript
- **Backend**: Firebase 12 — Firestore, Auth, Storage, App Check (reCAPTCHA v3)
- **Functions**: Firebase Cloud Functions v2 (Node 22), in `functions/` — uses OpenRouter (`google/gemini-2.5-flash`) for AI content moderation
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/postcss`)
- **Icons**: lucide-react
- **Testing**: Jest 30 + React Testing Library (jsdom); `@firebase/rules-unit-testing` for security rules
- **Deploy**: Vercel (frontend); Firebase (functions, rules, indexes)

## Commands
Run from repo root unless noted.
- `npm run dev` — start Next.js dev server (http://localhost:3000)
- `npm run build` — production build
- `npm start` — serve production build
- `npm run lint` — ESLint (eslint-config-next core-web-vitals)
- `npm test` — Jest (frontend, jsdom)
- `npm run test:watch` — Jest watch mode

Cloud Functions (from `functions/`):
- `npm test` — Jest for functions
- `npm run serve` — emulate functions only
- `npm run deploy` — `firebase deploy --only functions`
- `npm run logs` — tail function logs

Firebase emulators (firebase.json): Firestore on `:8080`, Functions on `:5001`.

## Environment
Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_FIREBASE_*` — client web app config (shipped to browser by design; secured by Firestore rules + App Check)
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — App Check (optional; App Check is skipped on `localhost`)
- `NEXT_PUBLIC_KOFI_URL` — optional; navbar "Support" button renders only when set
Functions secret: `OPENROUTER_API_KEY` (Firebase secret, not in `.env`).

## Architecture / layout
```
src/
├── app/                 # App Router: layout.js, page.js (the whole UI shell), error.js, robots.js
│   ├── admin/moderation/ # Moderation dashboard page
│   └── api/version/      # Route handler (version endpoint)
├── components/          # UI components (co-located *.test.js)
│   ├── Chat/  Codex/  Forum/  Legal/
│   └── (Navbar, WorldMap, CharacterDrawer, AuthScreen, ImageUploader, ...)
├── context/GameContext.js  # single global provider: auth/user, role, characters, read receipts, presence
├── hooks/               # custom hooks (e.g. useVersionCheck)
├── lib/                 # firebase.js (SDK init), constants.js, utils, searchUtils, navigation, moderation/
└── middleware.js        # security headers + CSP for all non-API routes
functions/               # Cloud Functions (index.js), validation.js, forbiddenKeywords.js
firestore.rules / storage.rules / firestore.indexes.json
```

Key patterns:
- **Single-page client app**: `src/app/page.js` is a large `"use client"` component holding all navigation state (`view`, `activeRegion`, `activeThread`, `activeCodexPage`, search, chat). Navigation is in-memory via `history.pushState`/`popstate`, not file routes. Heavy views (RegionView, ThreadView, Codex*, ChatSystem, CharacterDrawer) are `next/dynamic` lazy-loaded.
- **GameContext** (`src/context/GameContext.js`) is the auth + data hub: wraps `onAuthStateChanged`, sets up Firestore real-time listeners (role, read receipts, characters, presence heartbeat every 60s), and exposes `useGame()`. Context value is memoized.
- **Firestore path convention**: data lives under `artifacts/{APP_ID}/...`. `APP_ID = 'realm-of-allania-v2'` (defined in both `src/lib/constants.js` and `functions/index.js` — keep them in sync).
- **Roles**: `user` / `moderator` / `admin` / `banned`, stored at `artifacts/{APP_ID}/users/{uid}/settings/account`. The role doc self-heals (auto-created) if missing.
- **Security layers**: Firestore/Storage rules are the primary auth layer; CSP/security headers set in both `middleware.js` and `next.config.mjs`. App Check guards client calls.
- **Moderation**: Cloud Functions trigger on document writes / storage uploads and call OpenRouter (Gemini) for text/image moderation; keyword filtering in `validation.js` + `forbiddenKeywords.js`.

## Conventions
- `@/*` path alias maps to `src/*` (jsconfig.json + jest moduleNameMapper).
- Functional components + hooks only; `const`/`let` (never `var`); arrow functions for callbacks.
- Server Components by default; add `"use client"` only when state/effects/browser APIs are needed.
- Tests co-located as `*.test.js` next to the file under test.
- **Mock all Firebase in tests** — never hit real endpoints. Mock `@/lib/firebase`, `firebase/auth`, `firebase/firestore`, `firebase/storage`, and `@/context/GameContext` (`useGame`). See `.cursorrules` for the full mocking/testing playbook.
- Always clean up real-time listeners in `useEffect` return functions.
- When approving a child doc (Post), also update the parent (Thread) so it stays visible (status propagation).
- `firebase.js`, `auth`, `db`, `storage` may be `null` when env vars are absent — guard with null checks (the codebase does this everywhere).

## Gotchas
- **Name drift**: package.json is named `realm-of-aethelraed` and Cloud Function prompts/`.cursorrules` say "Aethelraed"; the product is "Realm of Allania". Both names refer to the same project (it was renamed).
- Emulator-dependent tests (root-level `firestore.rules.*.test.js` + `src/lib/moderation/moderation.test.js`) are excluded from `npm test` and run via `npx firebase emulators:exec --only firestore,functions "npx jest --config jest.rules.config.js"` (the moderation e2e test needs the functions emulator too).
- `firestore-debug.log` is an emulator artifact, not source.
- `.cursorrules` (and `.cursor/`, `.Jules/`) contain extensive project-specific guidance worth consulting for deeper conventions.
</content>
</invoke>
