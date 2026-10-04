---
category: forum
---
ThreadView from realm-of-aethelraed: the full screen for reading and replying to a roleplay thread. Use via `window.Allania.ThreadView` inside `<AllaniaProvider>`. It loads the thread and its posts itself from the thread id (sample world: `t-ember`, `t-watch` (locked "Sacred Text"), `t-keep`; `t-relic` and `t-marsh` have no posts), so don't pass posts in.

## Props

```ts
interface ThreadViewProps {
  thread: { id: string; title?: string; createdBy?: string; isLocked?: boolean };
  region?: { id: number | string; name?: string };
  setView?: (view: string) => void;
  onOpenCodex?: (characterIdOrTitle: string) => void;
  onNavigateToRegion?: (region: { id: number | string; name?: string }) => void;
  onMessageUser?: (target: { id: string; name: string; characterId?: string }) => void;
  onRequireAuth?: () => void;
  onWikiLink?: (title: string) => void;
}
```

## Layout and behavior

- Fills its parent's height and scrolls internally: put it in a flex column with a real height (`h-screen flex flex-col`). The reply bar and the CharacterDrawer are fixed to the bottom of the viewport.
- Page: `bg-ink-950` with a soft `--page-glow` at the top. Sticky header aligned to the `max-w-4xl` post column: pill Back button, title in fluid Cormorant (`clamp(1.75rem, 1.1rem + 2.4vw, 3.25rem)`), region line in small caps `gold-500`, and a `ThemeToggle` at the right edge.
- Posts (`PostItem`) rise in with a staggered 60ms fade (off under prefers-reduced-motion), 2.75rem apart.
- States: loading shows a skeleton header (when the title isn't known yet) and three skeleton posts; a thread with no posts shows "No posts yet". Signed-out readers get a "Join the chronicles to reply" bar instead of the editor.
- Theme-aware: works in dark and light and with every accent via `AllaniaProvider`'s `theme` / `accent`.

## Examples

### Signed-in reader

```jsx
<AllaniaProvider>
  <div className="h-screen flex flex-col">
    <ThreadView thread={{ id: 't-ember', title: 'Smoke over the Ember Road' }} region={{ id: 125, name: 'Thornwatch Ridge' }} />
  </div>
</AllaniaProvider>
```

### Light theme, verdigris accent

```jsx
<AllaniaProvider theme="light" accent="verdigris">
  <div className="h-screen flex flex-col">
    <ThreadView thread={{ id: 't-ember', title: 'Smoke over the Ember Road' }} region={{ id: 125, name: 'Thornwatch Ridge' }} />
  </div>
</AllaniaProvider>
```

### Loading

```jsx
<AllaniaProvider>
  <div className="h-screen flex flex-col">
    <ThreadView thread={{ id: '__pending__' }} region={{ id: 125, name: 'Thornwatch Ridge' }} />
  </div>
</AllaniaProvider>
```

### Empty thread

```jsx
<AllaniaProvider>
  <div className="h-screen flex flex-col">
    <ThreadView thread={{ id: 't-relic', title: 'A Relic Beneath the Ridge' }} region={{ id: 125, name: 'Thornwatch Ridge' }} />
  </div>
</AllaniaProvider>
```
