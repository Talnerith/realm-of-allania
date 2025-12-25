## 2024-05-23 - Unstable Props Defeating useMemo
**Learning:** `useMemo` and `React.memo` are useless if the props passed to the component (specifically functions) are re-created on every parent render.
**Action:** Always wrap handler functions in `useCallback` when passing them to memoized components or components using `useMemo` on derived state that depends on those handlers.
