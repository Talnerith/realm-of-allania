# Realm of Allania — building with this design system

Dark-fantasy play-by-post RPG (forum threads, world map, character roster, codex wiki, chat). Ink backgrounds, gold accents used sparingly, Cormorant Garamond for headings and story text, Inter for interface text.

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

Props: `signedIn={false}` (guest view), `role="moderator" | "admin" | "trusted" | "user"` (mod tools appear for moderator/admin), `characters`, `activeCharId`, `user`, `readReceipts`, `data`.

**Sample world** (served automatically; replace via `data`): regions `125` Thornwatch Ridge, `130` The Saltmarsh Reach, `166` Emberfall Keep, `190` Silverwood (empty); threads `t-ember`, `t-watch` (locked "Sacred Text"), `t-relic`, `t-marsh`, `t-keep`; codex pages `k-keep`, `k-oath`, `k-aldric`, `k-silver`; player characters `c-aldric` (Aldric Vane), `c-lyra` (Lyra Moonwhisper). Components fetch their own data from this world: give `ThreadView` a thread id and `RegionView` a region id; don't pass posts in.

**Full-screen views** (`ThreadView`, `RegionView`, `WorldMap`, `CodexIndex`, `SearchResults`, `LegalDocs`) fill their parent's height. Put them in a flex column with a real height (`h-screen flex flex-col`). `CharacterDrawer`, `ChatSystem` (`isOpen`), `ActiveUsers` (`isOpen`) and `CookieBanner` are fixed-position overlays.

## Styling: Tailwind utility classes (only compiled classes exist)

Use these families. Arbitrary values (`w-[523px]`) and unlisted colors are not compiled and will silently do nothing.

| Purpose | Classes |
|---|---|
| Page / surfaces | `bg-ink-950` page, `bg-ink-900` panels, `bg-ink-800` raised/inputs |
| Borders | `border border-ink-800`, `border-ink-700`, accent `border-gold-700` / `border-gold-900/50` |
| Text | `text-ink-200` body, `text-ink-400` / `text-ink-500` muted, `text-gold-500` headings/links, `text-gold-100` emphasis |
| Primary button | `bg-gold-700 hover:bg-gold-600 text-white rounded px-4 py-2` |
| Danger / success / info | `text-red-400 bg-red-950 border-red-900`, `text-emerald-400`, `text-cyan-400` |
| Tints | `bg-gold-900/30`, `bg-ink-900/50`, `bg-black/60` (opacities 10–90 on ink/gold 500–950) |
| Type | `font-serif` (Cormorant: titles, character names, story text), `font-sans` (Inter, default); sizes `text-2xs` (smallest, 11px) … `text-7xl`; `uppercase tracking-widest` for small labels |
| Layout | flex/grid (`grid-cols-1..6`, `md:` / `lg:` variants), spacing `p-*`/`gap-*` 0–24, `max-w-xs..7xl`, `rounded-sm..full`, `shadow-*` |

Ramps: `ink-50…950` (neutrals) and `gold-50…950` (accent), each 50, 100–900, 950. Story text pattern: `font-serif text-xl leading-relaxed text-ink-200`. Section title: `font-serif text-3xl text-gold-500`.

## Where the truth lives

- `styles.css` → `_ds_bundle.css`: the compiled stylesheet. Token variables (`--color-ink-*`, `--color-gold-*`, `--font-cormorant`, `--font-inter`) are in its `:root`.
- `components/<group>/<Name>/<Name>.d.ts` and `.prompt.md`: each component's props and usage.

## Images

Only images hosted in the project's Firebase Storage are displayed. Others render blank (portraits fall back to the character's initial). Don't use external image URLs; leave `imageUrl` empty for a clean initial-letter portrait.
