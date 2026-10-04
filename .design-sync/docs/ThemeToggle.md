---
category: general
---
ThemeToggle from realm-of-aethelraed: a pill button that switches between dark and light. Use via `window.Allania.ThemeToggle` inside `<AllaniaProvider>`. It shows the mode it switches to: a sun/moon icon on small screens, icon plus "Light mode" / "Dark mode" from md up. The choice is saved and synced across tabs.

## Props

```ts
interface ThemeToggleProps {
  /** Extra classes, e.g. positioning (ml-auto) */
  className?: string;
}
```

## Examples

### In a header

```jsx
<AllaniaProvider>
  <header className="flex items-center gap-4 px-6 py-4 bg-ink-950 border-b border-(color:--card-border)">
    <h1 className="font-serif text-2xl text-gold-100">The Codex</h1>
    <ThemeToggle className="ml-auto" />
  </header>
</AllaniaProvider>
```
