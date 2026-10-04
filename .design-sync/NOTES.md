# design-sync notes: Realm of Allania

How this repo syncs to Claude Design (project "Realm of Allania", id in config.json).

## How the build works (this is an app, not a component library)
- No library build exists, so `buildCmd` (`node .design-sync/build-dist.mjs`) compiles `entry.js` → `.design-sync/.cache/dist/index.mjs` with esbuild (`.js` files contain JSX → `loader: {'.js': 'jsx'}`), and compiles `tailwind.css` (the app's `globals.css` + a utility safelist) → `allania.css`. Run it before `package-build.mjs` / `resync.mjs`.
- esbuild comes from `.ds-sync/node_modules` (staged converter deps); postcss/Tailwind/react from the repo's own `node_modules`. Pass `--node-modules ./node_modules`.
- The data/auth layer is swapped for stand-ins (`stubs/`). The UI components are the app's own:
  - `@/context/GameContext` → `AllaniaProvider` (signed-in sample player; `signedIn`, `role`, `data` props)
  - `firebase/firestore` → in-memory store serving `sample-data.js` (where/orderBy/limit supported; writes are no-ops)
  - `@/lib/firebase`, `firebase/storage`, `firebase/functions` → truthy handles + no-op calls
  - `@/lib/constants` → real values, but `MAP_IMAGE_URL` inlined from `assets/map-preview.webp` (1400px)
  - `next/link` → plain `<a>`
  - A new `firebase/*` import in a component fails the build with "has no design-sync stand-in": add it to `SWAPS` in build-dist.mjs.
- Fonts: Inter + Cormorant Garamond Latin woff2 from @fontsource, committed in `fonts/` (the app loads them via next/font).
- Previews import shared helpers from `preview-helpers.tsx` (Frame contains fixed-position overlays via `transform`; ClickOnMount opens click-to-open UI by aria-label).

## Fixes made to the app while syncing (2026-10-04)
- Avatars without a portrait rendered an `<img src="">` (broken-image alt text) instead of the initial: fixed in PostItem, CharacterListItem, ThreadView reply box.
- NotificationBell toggle had no aria-label: added `aria-label="Notifications"` + `aria-expanded` (the preview clicks it by that label).

## Known render warns / limitations
- LandingPage: the tutorial video and hero art come from the app's `/public` folder, which doesn't exist in Claude Design, so the video box is empty. Graded good otherwise.
- CookieBanner appears after a 1s timer in the app; its preview shortens that timer (preview-only patch of `window.setTimeout`).
- Capture freezes the clock, so dates in cards read as a fixed 2024 date.
- ActiveUsers hides presence older than the app's cutoff (Brannock, 9 min) — correct behaviour.

## Re-sync risks
- `sample-data.js` mirrors real Firestore document shapes by hand. If a component starts reading a new field or collection, its preview silently shows empty states: check cards after component changes.
- `dtsPropsFor` in config.json is hand-written per component (plain JS has no types). A changed component signature needs the matching entry updated, or the design agent codes against a stale contract.
- The Tailwind safelist in `tailwind.css` defines what the design agent can use. Classes outside it (and not used in `src/`) don't exist in designs.
- `componentSrcMap` enumerates components explicitly; new components must be added there and to `entry.js`.
- Playwright pinned to 1.60.0 in `.ds-sync` to match the cached chromium-1223.

## Re-sync steps
1. Re-stage the converter: copy package-build/validate/capture/resync.mjs, lib/, storybook/ from the design-sync skill into `.ds-sync/`; `cd .ds-sync && npm i esbuild ts-morph @types/react @fontsource/inter @fontsource/cormorant-garamond playwright@1.60.0`.
2. `node .design-sync/build-dist.mjs`
3. Fetch the project's `_ds_sync.json` to `.design-sync/.cache/remote-sync.json`, then
   `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json`
- `ds-bundle/`, `.ds-sync/` and `.design-sync/.cache/` are gitignored and excluded from ESLint (eslint.config.mjs).
