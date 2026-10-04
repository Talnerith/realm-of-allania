---
category: general
---
AllaniaProvider from realm-of-aethelraed: the root wrapper every Realm of Allania design needs. Use via `window.Allania.AllaniaProvider`. It provides the theme (dark/light + accent palette), the signed-in player and their characters, and the sample world the components read. Without it, components render as a signed-out guest in the default dark theme.

## Props

```ts
interface AllaniaProviderProps {
  children?: React.ReactNode;
  /** 'dark' | 'light' | 'system' (follow the OS). Default: the enclosing AllaniaProvider's theme, else the saved choice, else 'system'. */
  theme?: 'dark' | 'light' | 'system';
  /** Accent palette mapped onto every gold-* class. Default: the enclosing provider's, else 'ember'. */
  accent?: 'ember' | 'brass' | 'verdigris';
  /** false = guest experience (no reply box, sign-in prompts). Default true. */
  signedIn?: boolean;
  /** Mod tools appear for 'moderator' and 'admin'. Default 'user'. */
  role?: 'user' | 'trusted' | 'moderator' | 'admin';
  user?: { uid: string; displayName?: string; email?: string; emailVerified?: boolean };
  characters?: Array<{ id: string; name: string; race?: string; class?: string; description?: string; imageUrl?: string }>;
  activeCharId?: string;
  readReceipts?: Record<string, number>;
  /** Replace the sample world: { "<collection path>": { <docId>: {...} } }. One data set per page. Loading states: give a component the id "__pending__" (e.g. a thread) and its queries never answer. */
  data?: Record<string, unknown>;
}
```

## Theme

- `theme` and `accent` set `data-theme` / `data-accent` on the provider's subtree. The `ink-*` and `gold-*` classes are re-mapped, so every component follows without any change: dark = warm charcoal ink with light text; light = the ink ramp inverted (`ink-950` is the paper, `ink-50` the darkest text) and gold shifted darker so `text-gold-500` links keep contrast on paper.
- Switching eases colors over 350ms. The choice is saved in localStorage (`allania-theme`) and synced across tabs.
- `useTheme()` (`window.Allania.useTheme`), inside the provider, returns `{ theme, setTheme, accent, preference }`: `theme` is the resolved `'dark' | 'light'`, `preference` may also be `'system'`, `setTheme('dark' | 'light' | 'system')` switches. `ThemeToggle` is a ready-made switch.
- Semantic tokens for surfaces that differ per theme: `--card-bg`, `--card-border`, `--card-shadow`, `--story` (long-form text color), `--page-glow`. Use them as `bg-(color:--card-bg)`, `border-(color:--card-border)`, `shadow-(--card-shadow)`, `text-(color:--story)`.
- Text on ink surfaces should use `text-ink-50` (never `text-white`, which disappears on light paper). Keep `text-white` only on `bg-gold-700` buttons and other colored fills.

## Examples

### Dark (default)

```jsx
<AllaniaProvider>
  <div className="h-screen flex flex-col bg-ink-950 text-ink-200">
    <ThreadView thread={{ id: 't-ember', title: 'Smoke over the Ember Road' }} region={{ id: 125, name: 'Thornwatch Ridge' }} />
  </div>
</AllaniaProvider>
```

### Light, brass accent

```jsx
<AllaniaProvider theme="light" accent="brass">
  <div className="min-h-screen bg-ink-950 text-ink-200 p-8">
    <h1 className="font-serif text-4xl text-gold-500">The Codex</h1>
  </div>
</AllaniaProvider>
```

### Theme switch inside a design

```jsx
function Header() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Toggle</button>;
}

<AllaniaProvider theme="system"><Header /></AllaniaProvider>
```

### Guest / moderator / loading

```jsx
<AllaniaProvider signedIn={false}>…</AllaniaProvider>
<AllaniaProvider role="moderator">…</AllaniaProvider>
<AllaniaProvider>…</AllaniaProvider>
<ThreadView thread={{ id: '__pending__' }} />   {/* loading skeleton */}
```
