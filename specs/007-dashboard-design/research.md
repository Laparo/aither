# Research: 007 — Dashboard Design

**Date**: 2026-03-25 | **Branch**: `007-dashboard-design`

## R1: Hemera Design System Integration into Aither

### Decision
Create a dedicated theme infrastructure under `src/app/components/theme/` that
replicates the Hemera design system: design tokens, MUI theme configuration,
and ThemeRegistry wrapper.

### Rationale
- Aither currently has `AppRouterCacheProvider` in `layout.tsx` but no MUI
  theme provider — components use MUI defaults.
- The existing `src/lib/slides/design-tokens.ts` contains CSS variable tokens
  for **slide HTML generation** (not React rendering). These are output
  artifact tokens, not UI tokens.
- The Hemera design system defines a complete MUI theme (palette, typography,
  component overrides) that must be replicated for visual coherence.
- MUI 7 + Next.js 16 App Router requires the Emotion-based
  `AppRouterCacheProvider` (already present) combined with `ThemeProvider`
  and `CssBaseline`.

### Alternatives Considered
1. **Import Hemera theme directly as npm package** — Rejected: Hemera is a
   separate project, not a published package. Copy-and-adapt is simpler and
   avoids cross-project coupling.
2. **Shared monorepo package** — Rejected: Projects are in separate
   repositories. Overhead not justified for theme tokens.
3. **CSS-only approach (no MUI theme)** — Rejected: Constitution V mandates
   MUI theme configuration adoption, not just CSS variables.

### Implementation Approach
- Create `src/app/components/theme/design-tokens.ts` with Hemera's color
  palette, typography, and spacing tokens.
- Create `src/app/components/theme/theme.ts` with MUI `createTheme()` using
  the design tokens (palette, typography overrides, component overrides).
- Create `src/app/components/theme/ThemeRegistry.tsx` as a Client Component
  wrapping `AppRouterCacheProvider` → `ThemeProvider` → `CssBaseline`.
- Update `src/app/layout.tsx` to use `ThemeRegistry` instead of bare
  `AppRouterCacheProvider`.
- Create `src/app/globals.css` with `--hemera-*` CSS variables and Google
  Fonts imports (Inter + Playfair Display).

---

## R2: Participant Avatar Images

### Decision
Use MUI `Avatar` component with initials-based fallback. Do not extend the
Hemera service API in this feature.

### Rationale
- The Hemera `User` model has an `image` field (synced from Clerk
  `imageUrl`), but the service API endpoint
  (`/api/service/courses/[id]`) does not include it in the participant
  response.
- Extending the Hemera API is out of scope for a dashboard design feature
  in the Aither project.
- MUI `Avatar` with `stringAvatar()` helper generates colored initials
  automatically — good UX without external data.

### Alternatives Considered
1. **Extend Hemera service API to include `imageUrl`** — Deferred: requires
   changes in a separate project. Can be added later as an enhancement.
2. **Fetch Clerk images directly via Clerk API** — Rejected: violates
   stateless architecture (would need Clerk credentials in Aither) and
   bypasses the Hemera API as single source of truth.

### Future Enhancement
When image URLs become available from the Hemera API, the `Avatar` component
can be updated to use `src={participant.imageUrl}` with initials as fallback
via the `children` prop.

---

## R3: Server Component vs Client Component Split

### Decision
Keep `page.tsx` as a Server Component for SSR data fetching. Extract
presentational card/list components as Client Components where interactivity
is needed (tooltips, hover effects, click handlers), and as Server Components
where they are purely presentational.

### Rationale
- Current `page.tsx` fetches data via `fetchNextCourseDetail()` and
  `fetchSlideStatus()` at the server level — this must remain SSR for
  performance (no client-side waterfall).
- MUI components that use browser APIs (e.g., `Chip` with click handlers,
  `Avatar` with image loading) need `'use client'`.
- Pure layout components (grids, typography) can remain server-rendered.

### Implementation Approach
- `page.tsx`: Server Component — fetches data, passes props to sections.
- Section cards: Client Components (`'use client'`) — receive data as props,
  render MUI Paper/Card with interactive elements.
- Keep existing client components (`CameraSnapshot`, `EndpointStatus`,
  `SlideGenerateButton`, `SlideThumbnails`) unchanged.

---

## R4: CSS Grid Layout for Dashboard Sections

### Decision
Use CSS Grid via MUI `Box` with `display: 'grid'` for the two-column
section layouts, matching the Hemera landing page pattern.

### Rationale
- Hemera's `CourseProgressionSection` uses CSS Grid with responsive
  `gridTemplateColumns` — established pattern.
- CSS Grid with `align-items: stretch` gives equal-height cards
  automatically.
- Simpler than MUI `Grid2` component for this fixed two-column layout.

### Alternatives Considered
1. **MUI Grid2 component** — Rejected: More verbose for a simple 2-column
   layout. CSS Grid via `Box sx` is more direct.
2. **Flexbox** — Rejected: Equal-height cards require extra CSS with
   flexbox. Grid handles it natively.
