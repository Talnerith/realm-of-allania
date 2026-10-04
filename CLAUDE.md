# CLAUDE.md

## What this is
Realm of Allania — a web-based Play-by-Post (PbP) roleplaying platform (interactive world map, forum threads, character roster, a Codex/wiki, real-time chat) built on Next.js + Firebase.

## Stack
- **Framework**: Next.js 16 (App Router), React 19 — JavaScript (ES6+), no TypeScript
- **Backend**: Firebase 12 — Firestore, Auth, Storage, App Check (reCAPTCHA v3)
- **Functions**: Firebase Cloud Functions v2 (Node 22), in `functions/` — uses OpenRouter for AI content moderation (model is the `OPENROUTER_MODEL` constant in `functions/index.js`; must support vision + reasoning)
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/postcss`)
- **Icons**: lucide-react
- **Testing**: Jest 30 + React Testing Library (jsdom); `@firebase/rules-unit-testing` for security rules
- **Deploy**: Vercel (frontend, auto-deploys on push to `main`); Firebase (functions, rules, indexes)
- **Node**: 22 (Next.js 16 needs ≥20.9; functions `engines.node` is 22)

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
- Rules + end-to-end moderation tests: `npx firebase emulators:exec --only firestore,functions "npx jest --config jest.rules.config.js"`
- World map: `node scripts/optimize-map.js <source.png>` (2816×1504) rebuilds `public/map.webp`, `og-image.jpg` and the sign-in backdrop.

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
functions/               # Cloud Functions: index.js (moderation), importImage.js, characterSync.js, moderatorTools.js, validation.js, forbiddenKeywords.js
scripts/                 # optimize-map.js, Firestore backfill scripts (need GOOGLE_APPLICATION_CREDENTIALS)
.design-sync/            # Claude Design sync setup (see "Claude Design sync" below)
firestore.rules / storage.rules / firestore.indexes.json
```

Key patterns:
- **Single-page client app**: `src/app/page.js` is a large `"use client"` component holding all navigation state (`view`, `activeRegion`, `activeThread`, `activeCodexPage`, search, chat). Navigation is in-memory via `history.pushState`/`popstate`, not file routes. Heavy views (RegionView, ThreadView, Codex*, ChatSystem, CharacterDrawer) are `next/dynamic` lazy-loaded.
- **GameContext** (`src/context/GameContext.js`) is the auth + data hub: wraps `onAuthStateChanged`, sets up Firestore real-time listeners (role, read receipts, characters, presence heartbeat every 60s), and exposes `useGame()`. Context value is memoized.
- **Firestore path convention**: data lives under `artifacts/{APP_ID}/...`. `APP_ID = 'realm-of-allania-v2'` (defined in both `src/lib/constants.js` and `functions/index.js` — keep them in sync).
- **Roles**: `user` / `moderator` / `admin` / `banned`, stored at `artifacts/{APP_ID}/users/{uid}/settings/account`. The role doc self-heals (auto-created) if missing.
- **Security layers**: Firestore/Storage rules are the primary auth layer; CSP is set in `src/middleware.js`; the other security headers (HSTS, X-Frame-Options, etc.) in `next.config.mjs`. App Check guards client calls.
- **Moderation**: Cloud Functions trigger on document writes / storage uploads and call OpenRouter for text/image moderation; keyword filtering in `validation.js` + `forbiddenKeywords.js`. Verdict parsing is strict on purpose: only a bare `SAFE` approves, `REJECT`/`UNSAFE` must lead the reply, anything else goes to `needs_review` (a wordy reply often means the model was being talked into it). Thinking is on at low effort with `exclude: true`; keep `max_tokens` large enough for the reasoning or the verdict comes back empty.
- **Moderation flow**: clients create posts/threads/codex pages as `pending` (only mods may write `approved`), and every non-mod content edit must set `status: 'pending'` (rules enforce it). The functions moderate only `pending` docs and write the verdict in a transaction only if the content is unchanged (`applyVerdictIfUnchanged`). Trusted users skip the AI step but never the keyword filter; images are always AI-checked. A thread is approved with its creator's first approved post, and its title is moderated with that post. A codex edit that fails moderation restores `approvedSnapshot` instead of hiding the page; the log's `proposedEdit` lets a mod apply it. Auto-promotion to `trusted` needs verified email, 14-day-old account, 10 approved items across 3+ threads (`PROMOTION_RULES`).
- **Images**: only Storage-hosted images render (`src/lib/imageUrls.js` `hostedImageUrl`/`isHostedImageUrl`; CSP `img-src` matches). Pasted URLs go through the `importImageFromUrl` callable (`functions/importImage.js`), which blocks private/metadata addresses, caps size, checks magic bytes and rate-limits, then saves to Storage where `moderateImage` checks it.
- **Logic moderation (no AI)**: chat messages, character profiles and display names use the keyword + reserved-name filters in `src/lib/moderation/textRules.js`, enforced by `hasForbiddenText`/`isReservedName` in firestore.rules. After changing `forbiddenKeywords.js` (keep the `functions/` copy identical) or `RESERVED_NAME_WORDS`, regenerate the two rules lines — `textRules.test.js` fails until they match.
- **Chats** store `participantCharacters: {uid: characterId}` (rules check both characters exist); names are resolved from the character docs, never typed in. Legacy chats may still have free-text `participantNames`.
- **Characters**: the `syncCharacter` function copies name/race/class/portrait changes to the user's posts and threads, marks them `[Deleted]` on delete and archives the character's codex page; the client only writes the character doc. Moderators delete players' images via the `deleteUserImage` callable (storage rules are owner-only). Admins can import images that still point at outside hosts (hidden on the site) from the moderation dashboard: the `migrateExternalImages` callable (`functions/imageMigration.js`, dry run first) copies each into the owner's Storage folder and rewrites banners, portraits, codex galleries and markdown images.
- **firebase-admin** stays on 13.x: v14 removed the namespaced `admin.firestore()`/`admin.storage()`/`admin.auth()` API used throughout `functions/`; upgrading means migrating to `getFirestore()` etc. from `firebase-admin/firestore` and friends. Patched transitive deps are pinned with `overrides` (`@grpc/grpc-js` at the root, `uuid` in functions).
- **Write requirements**: content writes require `request.auth.token.email_verified` (`canWrite()` in rules) and server timestamps (`updatedAt == request.time`) on threads and chats.

## Conventions
- `@/*` path alias maps to `src/*` (jsconfig.json + jest moduleNameMapper).
- Functional components + hooks only; `const`/`let` (never `var`); arrow functions for callbacks.
- Server Components by default; add `"use client"` only when state/effects/browser APIs are needed.
- Tests co-located as `*.test.js` next to the file under test.
- **Mock all Firebase in tests** — never hit real endpoints. Mock `@/lib/firebase`, `firebase/auth`, `firebase/firestore`, `firebase/storage`, and `@/context/GameContext` (`useGame`).
- Always clean up real-time listeners in `useEffect` return functions.
- When approving a child doc (Post), also update the parent (Thread) so it stays visible (status propagation).
- **Design tokens** live in `src/app/globals.css` (`@theme`): use `ink-*` (neutral) and `gold-*` (accent) colors, never raw `slate-*`/`amber-*`; `font-serif` (Cormorant Garamond) for display/prose, `font-sans` (Inter) for UI; `text-2xs` (11px) is the smallest text size. Change the look by editing tokens, not by editing hundreds of class names.
- **Themes**: `<html data-theme="dark|light" data-accent="ember|brass|verdigris">` remaps the `ink-*`/`gold-*` ramps (light inverts ink). `ThemeProvider`/`useTheme()` in `src/context/ThemeContext.js` (persists to localStorage `allania-theme`, follows `prefers-color-scheme`, syncs tabs); `src/lib/theme.js` holds the pre-paint script. On ink surfaces use `text-ink-50`, never `text-white` (invisible on light paper) — `text-white` only on `bg-gold-700`/colored fills. Card surfaces: `bg-(color:--card-bg) border-(color:--card-border) shadow-(--card-shadow)`; story text `text-(color:--story)`. Light-only tweaks: the `light:` variant. After token changes run `node .design-sync/verify-theme.mjs` (overflow, toolbar clipping, 4.5:1 contrast in every theme × accent).
- **Portraits/avatars**: render the `<img>` only when `hostedImageUrl(url)` returns a URL, with the character's initial as the fallback underneath. An `<img src="">` shows broken-image alt text, not the fallback.
- `firebase.js`, `auth`, `db`, `storage` may be `null` when env vars are absent — guard with null checks (the codebase does this everywhere).

## Gotchas
- **Name drift**: package.json is named `realm-of-aethelraed` and Cloud Function prompts say "Aethelraed"; the product is "Realm of Allania". Both names refer to the same project (it was renamed).
- Emulator-dependent tests (root-level `firestore.rules.*.test.js` + `src/lib/moderation/moderation.test.js`) are excluded from `npm test` and run via `npx firebase emulators:exec --only firestore,functions "npx jest --config jest.rules.config.js"` (the moderation e2e test needs the functions emulator too).
- `firestore-debug.log` is an emulator artifact, not source.

## Claude Design sync
The components, tokens and fonts are synced to the Claude Design project "Realm of Allania" (id in `.design-sync/config.json`). `.design-sync/build-dist.mjs` compiles `src/components` with the data/auth layer swapped for stand-ins (`stubs/`, sample world in `sample-data.js`, `AllaniaProvider`), plus the app's Tailwind CSS with a utility safelist (`tailwind.css`). Previews live in `.design-sync/previews/`; the design agent's guide is `.design-sync/conventions.md`. **Read `.design-sync/NOTES.md` before re-syncing.** When you add or change a component's props, also update `entry.js`, `componentSrcMap`/`dtsPropsFor` in `config.json`, and its preview, then re-sync with the `/design-sync` command.

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
- **Minified production bugs**: variables collapse to `_`/`a`/`b`; reproduce locally with `npm run build && npm start`. `Cannot access '_' before initialization` (TDZ) usually means hook-ordering issues — check `useCallback`/`useEffect` placement. In Cloud Functions the same error usually means a second block-scoped `const db` in a handler — declare `const db = admin.firestore()` once at the top of each handler.
- **CSP violations** (`Content Security Policy directive`): check the CSP in `src/middleware.js`. It must keep: `https://www.google.com` + `https://www.gstatic.com` in script-src and connect-src, and `https://www.google.com` in frame-src (reCAPTCHA / App Check — removing them breaks login silently); `wss://*.firebaseio.com` + `https://*.googleapis.com` in connect-src (Firestore/Storage); `https://fonts.googleapis.com` / `https://fonts.gstatic.com` for fonts.
- **Storage cleanup**: deleting an old image (avatar, banner) must never block the main operation — catch and log `deleteObject` failures (`storage/object-not-found` is expected).
- **`useMemo`/`React.memo` not preventing re-renders**: the props (especially handler functions) are likely re-created each parent render — wrap handlers in `useCallback` before passing to memoized children.

## Learnings log
Dated post-mortem entries (originally kept in `.Jules/`, removed in `06ef8ff` — see `git show 06ef8ff~1:.Jules/sentinel.md` for the full write-ups). Append new lessons here.

- **2024-05-23 — Unstable props defeat `useMemo`**: `useMemo`/`React.memo` are useless if handler props are re-created every parent render. Always `useCallback` handlers passed to memoized components.
- **2025-02-18 — Accessibility gaps**: heavy reliance on icon-only Lucide buttons and `div` + `onClick` without semantic HTML/ARIA (notably `Navbar.js`). When touching a component with icons, add `aria-label`/`title` and convert clickable `div`s to `<button>`.
- **2025-05-18 — Wiki integrity & audit trail**: on publicly-editable Wiki pages, security shifts from ownership to integrity/accountability. Enforce `lastEditorId == auth.uid` on writes and keep `creatorId` immutable via `!affectedKeys().hasAny(['creatorId'])`.
- **2025-10-26 — Firestore insecure creation (identity spoofing)**: rules let any authed user create threads/posts/chats with arbitrary `creatorId`/`userId`. Fixed with `request.resource.data.creatorId == request.auth.uid` on create, and `request.auth.uid in request.resource.data.participants` for chats.
- **2025-10-27 — Update identity spoofing**: ownership checks permit an update but don't protect the fields changed. Protect immutable identity/timestamp fields with `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['userId','creatorId','createdAt'])`.
- **2025-10-28 — Chat message spoofing & immutability**: nested subcollections inherit parent context but still need explicit validation. Split `read, write, delete` into granular perms; enforce `senderId == request.auth.uid` on create; deny `update` entirely to keep chat history append-only.
- **2025-12-24 — Mobile parity**: `md:hidden` mobile views duplicate desktop structure but can miss interactive handlers (`onClick`). Apply handlers to both mobile and desktop variants.
- **2026-10-04 — Security review fixes**: a review found moderation bypasses (unmoderated thread titles, farmable auto-trust, edit-after-flag swaps, race between edit and verdict, extension-less image uploads, hotlinked images) and rule gaps (client-set future timestamps pinning threads / blocking chats, flood control skippable, banned users editing characters). Also: `resource.data.isLocked` on a doc without that field is a rules *error* (deny) — use `resource.data.get('isLocked', false)`. `withSecurityRulesDisabled` doesn't return its callback's value.
- **2026-10-04 — Previews catch real bugs**: rendering every component with sample data for the Claude Design sync exposed broken-image avatars (`<img src="">`) and an unlabeled icon button that tests had never caught. Screenshot the component states, not just unit-test them. Also: `firebase-admin` 14 drops the namespaced API, and the emulator suite, not Jest mocks, is what catches that.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
