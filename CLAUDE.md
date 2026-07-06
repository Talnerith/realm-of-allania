# CLAUDE.md

## What this is
Realm of Allania — a web-based Play-by-Post (PbP) roleplaying platform (interactive world map, forum threads, character roster, a Codex/wiki, real-time chat) built on Next.js + Firebase.

## Stack
- **Framework**: Next.js 16 (App Router), React 19 — JavaScript (ES6+), no TypeScript
- **Backend**: Firebase 12 — Firestore, Auth, Storage, App Check (reCAPTCHA v3)
- **Functions**: Firebase Cloud Functions v2 (Node 22), in `functions/` — uses OpenRouter (`google/gemini-3.1-flash-lite`) for AI content moderation
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
- **Mock all Firebase in tests** — never hit real endpoints. Mock `@/lib/firebase`, `firebase/auth`, `firebase/firestore`, `firebase/storage`, and `@/context/GameContext` (`useGame`).
- Always clean up real-time listeners in `useEffect` return functions.
- When approving a child doc (Post), also update the parent (Thread) so it stays visible (status propagation).
- `firebase.js`, `auth`, `db`, `storage` may be `null` when env vars are absent — guard with null checks (the codebase does this everywhere).

## Gotchas
- **Name drift**: package.json is named `realm-of-aethelraed` and Cloud Function prompts say "Aethelraed"; the product is "Realm of Allania". Both names refer to the same project (it was renamed).
- Emulator-dependent tests (root-level `firestore.rules.*.test.js` + `src/lib/moderation/moderation.test.js`) are excluded from `npm test` and run via `npx firebase emulators:exec --only firestore,functions "npx jest --config jest.rules.config.js"` (the moderation e2e test needs the functions emulator too).
- `firestore-debug.log` is an emulator artifact, not source.

## Testing playbook
Condensed from the project's accumulated testing conventions.
- **Reset between tests**: `beforeEach(() => jest.clearAllMocks())`; keep tests independent (no shared state).
- **Mock all Firebase** (`@/lib/firebase`, `firebase/auth`, `firebase/firestore`, `firebase/storage`) and `@/context/GameContext` (`useGame`) — never hit real endpoints.
- **Testing Firebase error codes**: real Firebase errors carry a `.code`; construct them explicitly —
  ```js
  const err = new Error('Permission denied'); err.code = 'storage/unauthorized';
  deleteObject.mockRejectedValue(err);
  ```
- **Cloud Functions API mocking**: stub `global.fetch` with a capturing mock, assert on the captured `{ url, options }`, and restore the original in `afterEach`. This is how `functions/index.test.js` verifies the OpenRouter request shape.
- **Test config values, not just responses**: export config constants from the implementation (e.g. `module.exports.OPENROUTER_MODEL`) and assert the *actual* value in a test (`expect(OPENROUTER_MODEL).toMatch(/^google\/gemini/)`, `not.toMatch(/:free$/)`). Inline-mocked functions don't catch config regressions — that's why the model constant is exported.
- **Queries**: prefer `getByRole` / `getByLabelText` / `getByText` over `getByTestId`; use `queryBy*` to assert absence; `waitFor()` for async; `fireEvent` / `user-event` for interactions.
- **Coverage bar**: every util → ≥1 success + ≥1 edge/failure case; components → rendering, interactions, conditional branches, context/hook integration; Firestore rules → dedicated `@firebase/rules-unit-testing` files.

## Debugging patterns
- **Cryptic frontend errors can be backend symptoms**: a Chrome `storage/unauthorized` (or similar Firebase error) may be the surface of a crashed Cloud Function — check Google Cloud Function logs first (`npm run logs` from `functions/`).
- **Minified production bugs**: variables collapse to `_`/`a`/`b`; reproduce locally with `npm run build && npm start`. `Cannot access '_' before initialization` (TDZ) usually means hook-ordering issues — check `useCallback`/`useEffect` placement.
- **CSP violations** (`Content Security Policy directive`): check the CSP config in `middleware.js` and `next.config.mjs` (they must stay in sync).
- **`useMemo`/`React.memo` not preventing re-renders**: the props (especially handler functions) are likely re-created each parent render — wrap handlers in `useCallback` before passing to memoized children.

## Learnings log
Dated post-mortem entries carried over from the project's `.Jules/` notes. Append new lessons here.

- **2024-05-23 — Unstable props defeat `useMemo`**: `useMemo`/`React.memo` are useless if handler props are re-created every parent render. Always `useCallback` handlers passed to memoized components.
- **2025-02-18 — Accessibility gaps**: heavy reliance on icon-only Lucide buttons and `div` + `onClick` without semantic HTML/ARIA (notably `Navbar.js`). When touching a component with icons, add `aria-label`/`title` and convert clickable `div`s to `<button>`.
- **2025-05-18 — Wiki integrity & audit trail**: on publicly-editable Wiki pages, security shifts from ownership to integrity/accountability. Enforce `lastEditorId == auth.uid` on writes and keep `creatorId` immutable via `!affectedKeys().hasAny(['creatorId'])`.
- **2025-10-26 — Firestore insecure creation (identity spoofing)**: rules let any authed user create threads/posts/chats with arbitrary `creatorId`/`userId`. Fixed with `request.resource.data.creatorId == request.auth.uid` on create, and `request.auth.uid in request.resource.data.participants` for chats.
- **2025-10-27 — Update identity spoofing**: ownership checks permit an update but don't protect the fields changed. Protect immutable identity/timestamp fields with `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['userId','creatorId','createdAt'])`.
- **2025-10-28 — Chat message spoofing & immutability**: nested subcollections inherit parent context but still need explicit validation. Split `read, write, delete` into granular perms; enforce `senderId == request.auth.uid` on create; deny `update` entirely to keep chat history append-only.
- **2025-12-24 — Mobile parity**: `md:hidden` mobile views duplicate desktop structure but can miss interactive handlers (`onClick`). Apply handlers to both mobile and desktop variants.

