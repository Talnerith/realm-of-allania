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
- Previews import shared helpers from `preview-helpers.tsx` (Frame contains fixed-position overlays via `transform`; ClickOnMount opens click-to-open UI by aria-label; ClickSequence clicks several controls by aria-label or exact button text, waiting up to 2s for each to appear, so a click that needs loaded data (e.g. CodexIndex "New Page") doesn't fire before the stub data arrives).

## Fixes made to the app while syncing (2026-10-04)
- Avatars without a portrait rendered an `<img src="">` (broken-image alt text) instead of the initial: fixed in PostItem, CharacterListItem, ThreadView reply box.
- NotificationBell toggle had no aria-label: added `aria-label="Notifications"` + `aria-expanded` (the preview clicks it by that label).

## Known render warns / limitations
- LandingPage: the tutorial video and hero art come from the app's `/public` folder, which doesn't exist in Claude Design, so the video box is empty. Graded good otherwise.
- CookieBanner appears after a 1s timer in the app; its preview shortens that timer (preview-only patch of `window.setTimeout`).
- Capture freezes the clock, so dates in cards read as a fixed 2024 date.
- ActiveUsers hides presence older than the app's cutoff (Brannock, 9 min) — correct behaviour.

- [RENDER_THIN] "rendered height is 0px" on most cards: AllaniaProvider renders a `display: contents` wrapper (ThemeProvider scope="local"), which has no box of its own; the measured child is the wrapper. Benign: the screenshots render fully.
- [GRID_OVERFLOW] ThreadView "escape (fixed/portal)": the reply bar is position:fixed, but each card cell has transform:translateZ(0) and the stories wrap in Frame, so it stays inside its cell. Benign: confirmed in the sheets.

## Theme (added 2026-10-04)
- Themes live in the app: `src/context/ThemeContext.js` (ThemeProvider/useTheme), tokens in `src/app/globals.css`. AllaniaProvider wraps ThemeProvider with `scope="local"` so several themes can share a preview page. The catalogue default is pinned dark via `provider.props.theme` in config.json.
- `node .design-sync/verify-theme.mjs` (after a build) renders ThreadView + drawer in every theme × accent at 390/1440px and checks overflow, toolbar clipping and 4.5:1 text contrast. Run it after any color/token change.
- Loading previews use the id "__pending__" (firestore stand-in never answers queries for it); the sample store is global per page, so per-story `data` doesn't isolate.

## Palette change (2026-10-05)
- Neutral ramp retuned from warm charcoal to midnight navy; new default accent `gold` (antique gold), with ember/brass/verdigris kept as alternates. Pushed as a styling + bundle re-upload (only AllaniaProvider and ThreadView previews changed, for the new Gold stories); other cards recolor from the shared CSS without re-grading.
- A first `resync.mjs` run can report validate failed while a standalone `package-validate.mjs` passes; re-running resync cleared it (transient render-check flake).

## Brand icons (2026-10-05)
- `assets/icons/allania-tree-shield.png` (site crest) and `breville-tower-shield.png` (region crest): the user's own art (transparent PNGs), each with `-512`/`-256`/`-128` downscales. They replaced the first vector redraws (`allania-crest.svg`, `region-tower-crest.svg`, deleted from the project). Documented for the design agent in conventions.md "Brand icons".
- Codex section medallions (2026-10-05): `codex-characters-helm`, `codex-locations-castle`, `codex-history-scroll` (1254×1254 transparent PNGs from the user, same -512/-256/-128 set, downscaled with sharp by height). For the Codex index redesign: one per section column.
- Codex banners (2026-10-05): `assets/banners/codex-banner`, `codex-{characters,locations,history}-banner` (2172×724 opaque PNGs from the user, kept as-is, plus -1600/-1024/-640 WebP by width via sharp, q85). Upload `assets/banners/*` alongside `assets/icons/*`.
- Landing banner (2026-10-08): `assets/banners/landing-banner` (2172×724 PNG from the user's Desktop `Landing-page-banner.png`, plus -1600/-1024/-640 WebP q85), the LandingPage hero.
- Colored world map (2026-10-08): the user's redrawn map (`Map_of_Allania.png`, 1674×940, black letterbox bars, framed slightly differently) was registered onto the old 2816×1504 map, because WorldMap's 20×13 click grid is laid over the whole image. Fit by maximizing edge-map correlation at 1/4 scale (score 0.61): new_x = 0.6083·old_x − 13.98, new_y = 0.5945·old_y + 14.5 (native px). Letterbox rows 0–23 and 914–939 dropped, edges filled (mirror top/bottom, edge-copy left/right), resized to 2816×1504 (lanczos3). Outputs: `assets/maps/world-map-2816x1504.webp` (full, q85) and `assets/map-preview.webp` (1400px, inlined into the bundle as MAP_IMAGE_URL). For the app, run `node scripts/optimize-map.js .design-sync/assets/maps/world-map-2816x1504.webp` (the aligned copy), never the Desktop original.
- Replaced later on 2026-10-08 by `new-world-map.png` (1774×887, 2:1, map on a desk with props, geography redrawn so not a pure scale of the old one). Registered onto the old sepia `public/map.webp`: hand-picked landmarks → guided SIFT + RANSAC affine (new→old: x' = 1.7894x + 0.0032y − 166.0, y' = −0.0047x + 1.8648y − 84.9), then 4 passes of a smooth displacement field from patch template matching on gradient-magnitude images (64px step, tapered to zero within 96px of the frame edge). Residual inside the map ≈1–2px (title lettering and frame differ by design). Aligned source: Desktop `new-world-map-aligned-2816x1504.png`; same outputs as above (`world-map-2816x1504.webp` q85, `map-preview.webp` 1400px q82); the app's `public/` map files were rebuilt from it. The previous colored map is backed up in `.cache/backup-map-2026-10-08/`.
- Final map, later the same day: `allania-map-final.png` (2816×1504, the same artwork and framing as `new-world-map.png`, just higher resolution: a plain non-uniform resize of it, ×1.5874 × ×1.6956). The right size isn't enough; its land was 40–75px off the grid. It was aligned by reusing the verified sampling map above, scaled by those factors (enlargement now only about 1.13×, so much sharper); residual is 1–2px, the same as before. Aligned source: `.cache/allania-map-final-aligned-2816x1504.png` (gitignored, local only; the user deletes Desktop copies). Outputs and `public/` rebuilt from it. **Check every new map against the grid (patch shift vs `git show HEAD:public/map.webp`, the sepia original) even when it is already 2816×1504.**
- World map footer (2026-10-08): `assets/banners/world-map-footer` (1722×459 opaque, from the user's Desktop `world-map-footer.png`; its alpha channel was all 255, so it was dropped) as `.png` plus -1600/-1024/-640 WebP q85. Footer under WorldMap for legal links + contact. Documented in conventions.md "World map footer"; sky sampled at `#010c1c`.
- Character drawer art (2026-10-08): `assets/icons/character-roster-banner`, `character-edit-pen` (512/256/128 by height) and `character-name-scroll` (1024/640/320 by width), from the user's Desktop PNGs. The sources' "opaque" pixels were alpha 251–253, never 255 (about 1% see-through over a portrait), so alpha ≥240 was snapped to 255 and ≤8 to 0. Fully transparent margins were trimmed. Documented in conventions.md "Character drawer art". The 512 PNGs are 0.5–0.7 MB (noisy painted art): convert to WebP when copying them into the app's `public/`.
- Thin nameplate (2026-10-09): the user's `character-scroll-new.png` replaced the 4.6:1 `character-name-scroll` (which covered most of the portrait). Same alpha snap (≥240→255, ≤8→0) and trim → `assets/icons/character-name-scroll-thin.png` (2124×245) plus `-1024/-640/-320`; the old `character-name-scroll*` files were deleted locally and from `public/`, so delete them from the project's `assets/icons/` on the next sync and upload the four `-thin` files. App copies: `public/images/roster/character-name-scroll-thin-{640,1024}.webp` (new name so cached old files can't show).
- package-build wipes `ds-bundle/`, so copy `.design-sync/assets/icons/`, `.design-sync/assets/banners/` and `.design-sync/assets/maps/` into `ds-bundle/assets/` after the build and add `assets/icons/*` to the upload plan when the icons change. The driver's diff never sees `assets/` (not converter output): put `assets/**` in the plan's writes and upload only the changed asset files (2026-10-08 map swap: just `assets/maps/world-map-2816x1504.webp`; the ~26 MB of unchanged banner/icon PNGs were skipped). The map preview itself ships inside `_ds_bundle.js`, so a map change shows up as `upload.bundle: true` with every component `unchanged`.

## Handoff implementation (2026-10-08)
- The first Claude Design handoff (`design_handoff_realm_of_allania/`, screens 04 World Map and 10 Character Roster) was built into the app: `WorldMap` (fills its parent's width, region `<button>`s, `onRegionHover`), new `WorldMapPage` and `SiteFooter`, `LegalDocs initialTab`, and the redesigned `CharacterDrawer` / `CharacterListItem`. New cards: WorldMapPage (single card, primary story Page: its stories contain the fixed drawer) and SiteFooter.
- Site art now lives in `public/images/{brand,roster,footer}/` as WebP and is referenced through `src/lib/artAssets.js`. The build swaps that module for `stubs/artAssets.js`, which inlines one size of each file (no srcSet); keep the export names in sync.
- `NEXT_PUBLIC_PATREON_URL` is defined as the Patreon home page in the build so the footer's button shows in designs; in the app the button only renders when the env var is set.
- The handoff prototypes ignore `?theme=` / `?state=` when opened directly; compare light theme and states against the README, not the prototype screenshots.

- Navbar redesign (same day): 80px header per the handoff's global rule; previews SignedIn, OnCodex, AccountMenu, SearchOpen, Moderator, Guest. A mobile preview isn't possible (cards render at a 1280px viewport, so `lg:hidden` never shows the hamburger); check mobile with a real 390px viewport instead. ThreadView's own ThemeToggle was removed (the account menu has it).
- Sample data gained `profiles` (author names), `stats/site` and post `likeCount`s for the like buttons.

- `.design-sync/assets/{icons,banners,maps}/` are gitignored (2026-10-08, before the first public push): ~33 MB of full-resolution art, already stored in the Claude Design project. Only `assets/map-preview.webp` is tracked (the build inlines it). On a fresh clone, download any art a re-upload needs from the project's `assets/`; the app's own copies live in `public/images/`.

- Remaining handoff screens (2026-10-08): Region, Thread, Codex Index/Entry and Landing rebuilt. Codex/landing art lives in `public/images/{codex,landing}` and is inlined by `stubs/artAssets.js` (640 banners only, SVG icons via the `.svg` dataurl loader in build-dist). Sample data gained thread tags/views/excerpts/last posters, region blurbs, codex tags and structured codex text, and character join dates and reputation.
- `verify-theme.mjs` opens the (now collapsed) reply box before auditing the editor toolbar.
- Banners with fixed light text (thread, codex hero, codex entry) sit on a fixed dark base (`bg-[rgb(8_10_15)]`), not `bg-ink-900`, so light theme keeps contrast without an image.

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
- Drop cap font (2026-10-09): Pinyon Script (`fonts/pinyon-script-latin-400-normal.woff2`, from @fontsource/pinyon-script; `--font-pinyon` in tailwind.css) for `font-script`, used only by `Codex/DropCap`. Upload the woff2 and fonts.css on the next sync.
