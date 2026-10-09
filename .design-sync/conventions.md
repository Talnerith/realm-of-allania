# Realm of Allania — building with this design system

Dark-fantasy play-by-post RPG (forum threads, world map, character roster, codex wiki, chat). Midnight-navy ink surfaces with an antique-gold accent used sparingly (ember, brass and verdigris are alternates), dark and light themes, Cormorant Garamond for headings and story text, Inter for interface text.

## Always wrap in `AllaniaProvider`

Every component reads the signed-in player and game data through it. Without it they render as a signed-out guest.

```jsx
const { AllaniaProvider, Navbar, ThreadView } = window.Allania;

<AllaniaProvider>                      {/* signed-in sample player, role "user" */}
  <div className="h-screen flex flex-col bg-ink-950 text-ink-200">
    <Navbar currentView="thread" unreadCount={2} />
    <ThreadView thread={{ id: 't-ember', title: 'Smoke over the Ember Road' }} region={{ id: 125, name: 'Thornwatch Ridge' }} />
  </div>
</AllaniaProvider>
```

Props: `theme="dark" | "light" | "system"`, `accent="gold" | "ember" | "brass" | "verdigris"`, `signedIn={false}` (guest view), `role="moderator" | "admin" | "trusted" | "user"` (mod tools appear for moderator/admin), `characters`, `activeCharId`, `user`, `readReceipts`, `data`.

**Sample world** (served automatically; replace via `data`): regions `125` Thornwatch Ridge, `130` The Saltmarsh Reach, `166` Emberfall Keep, `190` Silverwood (empty); threads `t-ember`, `t-watch` (locked "Sacred Text"), `t-relic`, `t-marsh`, `t-keep`; codex pages `k-keep`, `k-oath`, `k-aldric`, `k-silver`; player characters `c-aldric` (Aldric Vane), `c-lyra` (Lyra Moonwhisper). Components fetch their own data from this world: give `ThreadView` a thread id and `RegionView` a region id; don't pass posts in.

**Full-screen views** (`ThreadView`, `RegionView`, `WorldMapPage`, `CodexIndex`, `SearchResults`, `LegalDocs`) fill their parent's height. Put them in a flex column with a real height (`h-screen flex flex-col`). `CharacterDrawer`, `ChatSystem` (`isOpen`), `ActiveUsers` (`isOpen`) and `CookieBanner` are fixed-position overlays.

## Themes

`ink-*` and `gold-*` are role names, re-mapped per theme: in light mode the ink ramp is inverted (`bg-ink-950` is the paper, `text-ink-50` the darkest text) and gold darkens so `text-gold-500` keeps contrast. So style with ink/gold and both themes work; never hard-code `text-white` or `bg-black` on ink surfaces (use `text-ink-50`, `bg-ink-950`). `text-white` is only for `bg-gold-700` buttons and other colored fills.

- `useTheme()` → `{ theme, setTheme, accent }`; `ThemeToggle` is a ready-made dark/light switch.
- Semantic surfaces: `bg-(color:--card-bg)`, `border-(color:--card-border)`, `shadow-(--card-shadow)`, `text-(color:--story)` (long-form story text), and `--page-glow` for a soft top-of-page radial.
- Loading states: pass the id `"__pending__"` (e.g. `thread={{ id: '__pending__' }}`) and that component's queries never answer.

## Styling: Tailwind utility classes (only compiled classes exist)

Use these families. Arbitrary values (`w-[523px]`) and unlisted colors are not compiled and will silently do nothing.

| Purpose | Classes |
|---|---|
| Page / surfaces | `bg-ink-950` page, `bg-ink-900` panels, `bg-ink-800` raised/inputs; cards `bg-(color:--card-bg) border-(color:--card-border) shadow-(--card-shadow) rounded-[14px]` |
| Borders | `border border-ink-800`, `border-ink-700`, accent `border-gold-700` / `border-gold-900/50` |
| Text | `text-ink-50` strongest, `text-ink-200` body, `text-ink-400` muted (`text-ink-500` only for large or decorative text), `text-gold-500` headings/links, `text-gold-100` emphasis |
| Primary button | `bg-gold-700 hover:bg-gold-600 text-white rounded px-4 py-2` |
| Danger / success / info | `text-red-400 bg-red-950 border-red-900`, `text-emerald-400`, `text-cyan-400` |
| Tints | `bg-gold-900/30`, `bg-ink-900/50`, `bg-black/60` (opacities 10–90 on ink/gold 500–950) |
| Type | `font-serif` (Cormorant: titles, character names, story text), `font-sans` (Inter, default); sizes `text-2xs` (smallest, 11px) … `text-7xl`; `uppercase tracking-widest` for small labels |
| Layout | flex/grid (`grid-cols-1..6`, `md:` / `lg:` variants), spacing `p-*`/`gap-*` 0–24, `max-w-xs..7xl`, `rounded-sm..full`, `shadow-*` |

Ramps: `ink-50…950` (neutrals) and `gold-50…950` (accent), each 50, 100–900, 950. Story text pattern: `font-serif text-[1.1875rem] md:text-[1.3125rem] leading-[1.7] text-(color:--story) max-w-[40rem]`. Section title: `font-serif text-3xl text-gold-500`.

## Where the truth lives

- `styles.css` → `_ds_bundle.css`: the compiled stylesheet. Token variables (`--color-ink-*`, `--color-gold-*`, the raw ramps `--n-*` / `--a-*`, the semantic `--card-*` / `--story` / `--page-glow`, `--font-cormorant`, `--font-inter`) are defined there per `[data-theme]` / `[data-accent]`.
- `components/<group>/<Name>/<Name>.d.ts` and `.prompt.md`: each component's props and usage.

## Navbar

`Navbar` is the site header on every page (80px, `bg-ink-950`, `gold-900/50` bottom border): the tree-shield crest with "Realm of Allania / CHRONICLES", the World Map · Codex · Members · Search tabs (lg and up; the active one has a 2px `gold-500` underline, and World Map stays active on region and thread pages), then messages, the notification bell and the account menu (Appearance theme switch, Moderation for staff, Legal and Terms, Sign out). Search opens a site search panel under the bar; Members opens `ActiveUsers`. Below lg the tabs and account items move into the hamburger menu. Use the component as is; don't rebuild a header. Posts carry a like button (heart + count, one like per player, not on your own posts).

## Pages

The main screens are built: use these components rather than recreating them.

- `LandingPage`: the welcome page (hero, live site counts, features, how it works).
- `WorldMapPage` (with `WorldMap`, `SiteFooter`).
- `RegionView`: region banner with crest and blurb, thread list with tags, replies, views and last poster, a Locations panel (the active character's threads and whose turn it is) and Recent activity.
- `ThreadView`: banner with breadcrumb, 8 posts per page, `PostItem` cards (character profile with joined, posts and reputation, post number, a "⋯" menu, thumbs-up like), a reply box floating above the roster bar, Thread Information. A sealed (locked) thread takes no new posts.
- `CodexIndex` and `CodexEntry`: three sections, Characters, Locations and History. An entry's facts (`**Race:** Human` lines), opening and closing quotes (`> ...` at the top and end) and related entries (`[[Wiki Links]]`) come from its text.

Thread tags come from a fixed list (Roleplay, Adventure, Lore, Investigation, Discussion, Open, Ongoing, Politics, Trade), up to 3 per thread. Codex tags are free text, up to 3.

## Images

Only images hosted in the project's Firebase Storage are displayed. Others render blank (portraits fall back to the character's initial). Don't use external image URLs; leave `imageUrl` empty for a clean initial-letter portrait.

## Brand icons

Five heraldic emblems (transparent PNGs, gold on a dark-navy field) live in `assets/icons/`. Each comes at full size plus 512/256/128px tall. Pick the smallest file that is at least 2× the displayed height (e.g. the 128 file for a 48px navbar logo, the 256 file for a 96px banner crest). Keep the aspect ratio (`height` set, `width: auto`) and don't recolor or crop them.

- `allania-tree-shield.png` (857×1173; `-512`, `-256`, `-128` variants): the site crest, a gold tree of life with roots. It is the brand mark, top-left of the Navbar beside "Realm of Allania / CHRONICLES".
- `breville-tower-shield.png` (892×1177; `-512`, `-256`, `-128` variants): the Breville city crest, a gold tower. It sits beside the region name in the RegionView banner. Use it as the default region crest until regions get their own.
- Codex section medallions, round with a gold rim and compass points (1254×1254 square; `-512`, `-256`, `-128` variants). Each heads its section's column on the Codex index, left of the section title:
  - `codex-characters-helm.png`: a gold crested helm, for **Characters** (people, races and notable figures).
  - `codex-locations-castle.png`: a gold three-towered castle, for **Locations** (cities, regions and places).
  - `codex-history-scroll.png`: an unrolled parchment scroll, for **History** (faiths, events and lore).

These are bundled local files, so unlike other images they always render.

## Codex banners

Four painted banners (opaque, 2172×724, 3:1) live in `assets/banners/`. Each comes as the original `.png` plus `-1600.webp`, `-1024.webp` and `-640.webp` (by width). Use the WebP files: `-1600` for full-width banners, `-1024` for a section column on desktop, `-640` on mobile. Show them with `object-fit: cover` and don't recolor or filter them. When text sits on a banner, put a gradient behind it so the text keeps contrast, and make the gradient and the text flip together: either both from the ink ramp (`bg-linear-to-r from-ink-950` with `text-ink-50`; light theme turns them into a pale fade with dark text), or both fixed (a black gradient with white text). Never mix a fixed dark gradient with `text-ink-*` text, which turns dark in light theme.

- `codex-banner`: candlelit study with an open atlas, globes and Allania tree banners. The hero banner across the top of the Codex index, behind "The Codex" title. It is much wider than tall on screen, so anchor it with `object-position: center 40%` to keep the open book in view.
- `codex-characters-banner`: a party of adventurers on a ridge at sunset, looking toward a city. Top of the **Characters** column.
- `codex-locations-banner`: a white-towered city over a lake and bridges, in daylight. Top of the **Locations** column. It is the brightest banner, so it needs the dark gradient most.
- `codex-history-banner`: candlelit archive with scrolls and a quill, a castle at dusk through the window. Top of the **History** column.

## Landing banner

`assets/banners/landing-banner` (same 2172×724 format and sizes as the Codex banners, same gradient and text rules): a grand library hall at golden hour, with blue Allania tree-of-life banners on the shelves, an open atlas, a globe and candles on the table, and a white castle on waterfall cliffs through the arched window on the right. It is the hero of the LandingPage (the welcome screen visitors see before signing in), behind the site title and the "Enter" call to action. Put the title and text on the left over the gradient, and keep the window and castle in view on the right: anchor it with `object-position: center 60%`, and on narrow screens `object-position: 70% 60%` so the castle stays visible.

## World map footer

`assets/banners/world-map-footer` (opaque, 1722×459, about 3.75:1; the original `.png` plus `-1600.webp`, `-1024.webp` and `-640.webp` by width): a dusk panorama with snowy mountains on the left, a lake town with lit towers in the middle, and a castle on cliffs against an orange sunset on the right. The top 40% is near-black navy sky (about `#010c1c`). It is the background of `SiteFooter` (already built in: use the component, don't rebuild it), the footer of `WorldMapPage` holding the legal links (Terms of Service, Privacy Policy, Cookie Policy: `onOpenLegal('tos' | 'privacy' | 'cookies')`, which opens `LegalDocs` with that `initialTab`), the contact info and the Patreon button.

- Put the footer text in the dark sky band at the top, never over the lit town or the sunset. Keep the castle in view: `object-fit: cover` with `object-position: center bottom`, and on narrow screens `object-position: 85% bottom`.
- The image is a night scene in every theme, so its text is fixed and light, the same as the banners' "both fixed" option: `text-white` for links, with gold for hover and accents. Never `text-ink-*`, which turns dark in light theme.
- Its sky is a little darker than the dark theme's `bg-ink-950` page, so blend the top edge with a short gradient (`bg-linear-to-b from-ink-950` to transparent, about 15% of the footer's height). In light theme that gradient becomes a pale fade into the paper page, which is the intended look.

## Character drawer art

Three transparent PNGs in `assets/icons/`, already built into `CharacterDrawer` and its roster cards (`CharacterListItem`): use those components rather than rebuilding them; these notes are for new places that show the same art. Their transparent margins are trimmed, so each file's edges are the artwork's edges. Same rules as the brand icons: pick the smallest file at least 2× the displayed size, keep the aspect ratio, don't recolor them.

- `character-roster-banner.png` (1267×1097; `-512`, `-256`, `-128` tall): a hanging blue pennant with the gold Allania tree on a gold rod with tassels. It is the drawer's title emblem, top-left of the drawer header beside the roster title.
- `character-edit-pen.png` (1112×1016; `-512`, `-256`, `-128` tall): a gold quill in a gold-framed navy tile. It is the edit-character button on each character. Render it as a `<button>` with `aria-label="Edit <character name>"` (the image is decorative, `alt=""`).
- `character-name-scroll.png` (2123×463, about 4.6:1; `-1024`, `-640`, `-320` wide): a parchment nameplate with a gold corner ornament on the left and a burnt, crumbling right end. It is laid **over** the character's portrait, with the character name written on it. The parchment is opaque, while the burnt right end and the gaps between its fragments are fully transparent, so the portrait shows through there by design. Keep the name inside the solid parchment: from about 6% of the plate's width (past the left ornament) to about 60% (where the burn starts), vertically centred. Parchment is light in every theme, so write the name in `font-serif` with a fixed dark colour (an inline `style={{ color: '#2b1d0e' }}`), never `text-ink-*` (flips with the theme) or `text-white`.

## World map

`assets/maps/world-map-2816x1504.webp` is the painted, colored world map (parchment on a wooden table) at the app's full map resolution. `WorldMap` already shows it (a 1400px copy is built into the bundle). `WorldMap` is just the map and its region grid: it fills its parent's **width** at the map's aspect, with no padding or scrolling of its own, and `onRegionHover({ id, name, threadCount, hasUnread } | null)` reports the region under the pointer. `WorldMapPage` is the whole page (title, legend, gold frame that scrolls the map sideways below 820px, live region readout, `SiteFooter`); use it for the world map screen. The clickable regions are a uniform 20×13 grid laid over the whole image, so the map must keep its exact 2816×1504 frame (aspect 1.872): never crop, pad, letterbox or reframe it, or the regions stop lining up with the land. Thumbnails (e.g. a landing-page teaser) can scale it down, but keep the whole image and its aspect ratio.

These, the brand icons, the banners and the character drawer art are the only bundled images. Unlike other images, they are local files, so they always render.
