## 2025-02-18 - Accessibility Gaps in Navigation
**Learning:** The application heavily relies on icon-only buttons (Lucide icons) and div-based interactivity without semantic HTML or ARIA labels. This is a consistent pattern in `Navbar.js` and likely other components.
**Action:** When touching any component with icons, always check for and add `aria-label` or `title`. Convert `div` with `onClick` to `<button>` where appropriate.

## 2025-12-24 - Mobile Parity in Interactive Elements
**Learning:** Mobile views (using `md:hidden`) often duplicate UI structure from desktop views (`md:flex`) but may miss critical interactive handlers (e.g., `onClick`).
**Action:** When modifying interactive components, ensure that handlers are applied to both mobile and desktop variants to maintain feature parity.
