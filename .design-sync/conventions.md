# Realm of Allania — building with this design system

Dark-fantasy play-by-post RPG (forum threads, world map, character roster, codex wiki, chat). Warm-charcoal ink surfaces, an ember accent used sparingly (brass and verdigris are alternates), dark and light themes, Cormorant Garamond for headings and story text, Inter for interface text.

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

Props: `theme="dark" | "light" | "system"`, `accent="ember" | "brass" | "verdigris"`, `signedIn={false}` (guest view), `role="moderator" | "admin" | "trusted" | "user"` (mod tools appear for moderator/admin), `characters`, `activeCharId`, `user`, `readReceipts`, `data`.

**Sample world** (served automatically; replace via `data`): regions `125` Thornwatch Ridge, `130` The Saltmarsh Reach, `166` Emberfall Keep, `190` Silverwood (empty); threads `t-ember`, `t-watch` (locked "Sacred Text"), `t-relic`, `t-marsh`, `t-keep`; codex pages `k-keep`, `k-oath`, `k-aldric`, `k-silver`; player characters `c-aldric` (Aldric Vane), `c-lyra` (Lyra Moonwhisper). Components fetch their own data from this world: give `ThreadView` a thread id and `RegionView` a region id; don't pass posts in.

**Full-screen views** (`ThreadView`, `RegionView`, `WorldMap`, `CodexIndex`, `SearchResults`, `LegalDocs`) fill their parent's height. Put them in a flex column with a real height (`h-screen flex flex-col`). `CharacterDrawer`, `ChatSystem` (`isOpen`), `ActiveUsers` (`isOpen`) and `CookieBanner` are fixed-position overlays.

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

## Images

Only images hosted in the project's Firebase Storage are displayed. Others render blank (portraits fall back to the character's initial). Don't use external image URLs; leave `imageUrl` empty for a clean initial-letter portrait.
