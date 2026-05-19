# Component Contracts: 007 — Dashboard Design

**Date**: 2026-03-25 | **Branch**: `007-dashboard-design`

## Overview

No new API endpoints are introduced. This feature restructures the dashboard
UI. Contracts define the component interfaces and rendering expectations.

---

## Theme Infrastructure Contracts

### ThemeRegistry

**File**: `src/app/components/theme/ThemeRegistry.tsx`  
**Type**: Client Component (`'use client'`)

```typescript
interface ThemeRegistryProps {
  children: React.ReactNode
}
```

**Contract**:
- MUST wrap children with `AppRouterCacheProvider` → `ThemeProvider` → `CssBaseline`
- MUST use the Hemera MUI theme from `./theme.ts`
- MUST be the outermost provider in `layout.tsx`

**Test assertions**:
- Renders children without error
- Applies Hemera palette (marsala primary color)
- Includes CssBaseline reset

### Design Tokens

**File**: `src/app/components/theme/design-tokens.ts`

**Contract**:
- MUST export `colors` object with all Hemera palette colors
- MUST export `spacing` object with `sectionPy`, `sectionPyCompact`, `containerMaxWidth`
- MUST export `typography` object with font families and weights
- All color values MUST match Hemera's canonical values

**Test assertions**:
- `colors.marsala` === `'#884143'`
- `colors.beige` === `'#EBE2D3'`
- `spacing.containerMaxWidth` === `'lg'`
- `typography.heading` includes `'Playfair Display'`
- `typography.body` includes `'Inter'`

### MUI Theme

**File**: `src/app/components/theme/theme.ts`

**Contract**:
- MUST create theme with `palette.primary.main` = marsala
- MUST set `palette.secondary.main` = bronze
- MUST set `palette.background.default` = beige
- MUST configure typography with Playfair Display for headings, Inter for body
- MUST override MuiContainer max-width for the `lg` breakpoint via `components.MuiContainer.styleOverrides.maxWidthLg` with `{ maxWidth: '1200px' }` (the MUI theme key `maxWidthLg` targets the CSS class `.MuiContainer-maxWidthLg`)
- MUST set `shape.borderRadius` = 8

**Test assertions**:
- `theme.palette.primary.main` === `'#884143'`
- `theme.palette.background.default` === `'#EBE2D3'`
- `theme.typography.h1.fontFamily` includes `'Playfair Display'`
- `theme.components.MuiContainer.styleOverrides.maxWidthLg` has `maxWidth: '1200px'`

---

## Dashboard Section Contracts

### Section A — CourseCard

**File**: `src/app/components/dashboard/section-a-course-card.tsx`  
**Type**: Server Component (no interactivity — error/empty/retry states are handled at the page level in `page.tsx`, not inside this component)

```typescript
interface CourseCardProps {
  course: ServiceCourseDetail
}
```

**Renders**:
- `Paper` wrapper with consistent padding `p: { xs: 2, md: 3 }`
- Course title as `Typography variant="h6"`
- Level badge as `Chip` (Grundkurs / Fortgeschritten / Masterclass)
- Start date, end date formatted as `dd.MM.yyyy`
- Participant count

**Note**: CourseCard only receives successfully fetched data. Error, empty, and loading states are rendered by `page.tsx` before CourseCard is mounted.

**Test assertions**:
- Renders course title text
- Renders level chip with correct German label
- Renders formatted dates (not raw ISO)
- Renders participant count
- Has `data-testid="course-card"`

### Section A — MaterialCard

**File**: `src/app/components/dashboard/section-a-material-card.tsx`  
**Type**: Client Component (contains `SlideGenerateButton`)

```typescript
interface MaterialCardProps {
  slideStatus: SlideStatus
}
```

**Note**: MaterialCard only receives a resolved `SlideStatus` object. Loading (Skeleton), error (Alert), and empty states at the *section level* are handled by `page.tsx` before MaterialCard is mounted — identical to the CourseCard pattern. MaterialCard itself renders the "Keine Folien vorhanden" empty state when `slideStatus.files` is empty and `slideStatus.status === 'not-generated'`.

**Renders**:
- `Paper` wrapper with consistent padding
- Status chip (Generiert / Nicht generiert) with success/default color
- Last updated date
- Slide count
- `SlideThumbnails` component (when files exist)
- `SlideGenerateButton` component

**Test assertions**:
- Renders status chip with correct label and color
- Renders slide count
- Renders formatted date
- Has `data-testid="material-card"`

### Section B — ParticipantsList

**File**: `src/app/components/dashboard/section-b-participants-list.tsx`  
**Type**: Client Component (`'use client'`) — expandable detail panels (Accordion-style `ListItem` rows) and local expand/collapse state require interactivity

```typescript
interface ParticipantsListProps {
  participants: ServiceParticipant[]
}
```

**Renders**:
- `Paper` wrapper with section heading "Teilnehmer & Vorbereitungen"
- MUI `List` with `ListItem` rows
- Each row: `Avatar` (initials from name) → name → completion status
- Each `ListItem` is expandable (click/tap toggles detail panel): expanded state reveals preparation intent, desired results, and line manager profile via a collapsible section (`Collapse` or inline expand). `aria-expanded` MUST reflect the current state.
- **Keyboard interaction**: `Enter` and `Space` on a focused `ListItem` MUST toggle the expanded state (updating `aria-expanded`). When expanding, focus MUST move to the first focusable element inside the `Collapse` panel (or remain on the `ListItem` if no focusable children exist). When collapsing, focus MUST return to the `ListItem` toggle. `Escape` on a focused element inside an expanded `Collapse` panel MUST close the panel and return focus to the `ListItem` toggle. Arrow keys (`ArrowUp` / `ArrowDown`) SHOULD navigate between `ListItem` rows within the `List`. `Home` / `End` MUST move focus to the first / last `ListItem` in the `List`. `Tab` / `Shift+Tab` MUST traverse focusable elements inside the expanded `Collapse` panel before moving out to the next focusable component in the page.
- **Collapse panel semantics**: Each `Collapse` panel MUST render a semantic container (`role="region"`) with `aria-labelledby` referencing the `id` of its parent `ListItem` toggle. When a `Collapse` opens or closes, the state change MUST be announced to assistive technology (e.g., via `aria-live="polite"` on a status element or programmatic focus movement that triggers announcement).
- Empty state: "Keine Teilnehmer." message

**Avatar logic**:
- Extract initials from the `name` field: split `name` by whitespace, take the first character of the first token and the first character of the last token. If `name` contains only one token, use its first character only.
- **Deterministic background color algorithm**: Given the full name string, compute `sum = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)`. The palette is a fixed array `AVATAR_COLORS = ['#884143', '#926A49', '#bc8f8f', '#5B9A8B', '#2D2D2D', '#6B4C3B', '#7A8B6F', '#8B6F7A']`. The background color index is `sum % AVATAR_COLORS.length`. All implementations MUST use this exact algorithm to produce identical colors.
- Fallback: when `name` is null or empty, display the glyph `"?"` with `AVATAR_COLORS[0]` as background color and the label "Unbekannt"

**Test assertions**:
- Renders one list item per participant
- Each item has an Avatar with initials
- Shows "Keine Teilnehmer." when array is empty
- Has `data-testid="participants-list"`

### Section B — SlidesList

**File**: `src/app/components/dashboard/section-b-slides-list.tsx`  
**Type**: Client Component (`'use client'`) — preview Modal requires local state

```typescript
interface SlidesListProps {
  slideStatus: SlideStatus
}
```

**Renders**:
- `Paper` wrapper with section heading "Kursfolien"
- MUI `List` with one row per slide file
- Each row: slide filename, clickable link that opens a preview Modal
- **Preview Modal**: MUI `Dialog` displaying the slide content (`<iframe>` or `<img>` depending on file type). The Modal includes: a close button (`IconButton` with `CloseIcon`), the slide filename as `DialogTitle`, and `data-testid="slide-preview-modal"`. Content is loaded from the local slide file path via a relative URL.
- **Preview error state**: When the slide file cannot be loaded (HTTP 404/500, network error, or read failure), the Modal body shows "Datei konnte nicht geladen werden" with a retry button that re-attempts the load. The faulty file path is logged via `reportError`.
- Empty state: "Keine Folien generiert." message

**Test assertions**:
- Renders one list item per file in `slideStatus.files`
- Each item shows the filename
- Clicking a filename opens the preview Modal with the correct filename as title
- Preview Modal has a close button that closes the Modal
- Preview error state renders error message and retry button when file load fails
- Empty state rendered when files is empty
- Has `data-testid="slides-list"`

### Section C — SteuerungCards

**File**: `src/app/components/dashboard/section-c-steuerung-cards.tsx`  
**Type**: Client Component (makes API health checks)

No external props — self-contained (reuses endpoint list and health-check logic from existing `EndpointStatus` component).

**Monitored endpoints**: The component reads the endpoint list from a shared export. The `endpoints` array currently defined as a private `const` inside `src/app/components/endpoint-status.tsx` MUST be extracted to a shared module:

```typescript
// src/app/components/endpoint-config.ts
export interface EndpointDef {
  label: string;
  path: string;
  method: 'GET' | 'POST';
  group: string;
  probeMethod?: 'HEAD' | 'GET';
  fallbackToGetOnHeadUnsupported?: boolean;
}

export const MONITORED_ENDPOINTS: EndpointDef[] = [
  // ... (existing endpoint definitions moved here)
];
```

Both `EndpointStatus` and `SteuerungCards` MUST import from this shared module:
```typescript
import { MONITORED_ENDPOINTS } from '@/app/components/endpoint-config';
```

This ensures a single source of truth for the endpoint list. No hard-coded endpoint list in either component.

**Runtime probe result**:

```typescript
export interface EndpointResult {
  status: 'prüfe' | 'erreichbar' | 'fehler';
  code?: number;
  probeMethod?: 'HEAD' | 'GET';
}
```

**Polling & data fetching**:
- Uses `fetch` + `useEffect` (no external library) for health checks
- Initial fetch on mount; polls every **10 seconds** thereafter
- Each endpoint is fetched independently; a single endpoint failure does not block others
- Default probe method is `HEAD`; if the endpoint returns `405` or `501` and `fallbackToGetOnHeadUnsupported !== false`, the probe retries with `GET`
- Requests MUST use `redirect: 'manual'` so auth redirects are treated as failures instead of reachable endpoints
- **Loading state**: On mount, each `Chip` shows label `"Laden…"` with `color="default"` until the first response
- **Reachable rule**: Non-redirect HTTP responses below `500` resolve to `status: 'erreichbar'`; redirect responses and network failures resolve to `status: 'fehler'`
- **Error handling**: Error chips show `color="error"`; tooltip text MAY include the HTTP status code and the effective probe method. Retries happen on the next poll interval.
- **Success**: `status: 'erreichbar'` renders a success chip labelled `"OK"`

**Renders**:
- Section heading "Steuerung"
- Grid of `Paper` cards, one per endpoint
- Each card: endpoint path, HTTP method, status `Chip` (OK / Error / Laden…)
- Responsive grid: `{ xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }`

**Test assertions**:
- Renders cards for all monitored endpoints
- Each card shows endpoint path and method
- Status chips show `"Laden…"` before first response
- Status chips reflect probe results (OK / Error) using the shared `EndpointResult` mapping
- Error chips have a `Tooltip` with error details when a code is available
- Has `data-testid="steuerung-cards"`

### Section D — CameraSection

**File**: `src/app/components/dashboard/section-d-camera-card.tsx`  
**Type**: Server Component (no interactivity — wraps existing CameraSnapshot)

No external props — self-contained (embeds existing `CameraSnapshot` component).

**Renders**:
- `Paper` wrapper with section heading “Kamera”
- Embedded `CameraSnapshot` component (existing)
- `data-testid="camera-card"`

**Delegated refresh contract**:
- `CameraSection` MUST NOT re-implement snapshot fetching logic; it wraps the existing `CameraSnapshot`
- `CameraSnapshot` owns loading state, retry / reconnect behavior, and any polling / backoff semantics required by Section D in [spec.md](../spec.md)
- Verification of polling and additive backoff belongs in dedicated `CameraSnapshot` tests rather than wrapper-component tests

**Test assertions**:
- Renders heading “Kamera”
- Contains embedded CameraSnapshot
- Has `data-testid="camera-card"`

---

## Page Layout Contract

### Dashboard Page

**File**: `src/app/page.tsx`

**Contract**:
- MUST use MUI `Container` with `maxWidth="lg"`
- MUST render four sections (A, B, C, D) vertically stacked
- Section A and B: CSS Grid with `gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }`
- Inter-section spacing: `mb: { xs: 4, md: 6 }`
- Cards use `align-items: stretch` for equal height
- Error fallback alert above sections when API unavailable
- "No course" info alert when no upcoming course

**Test assertions (E2E)**:
- Dashboard loads without errors
- Four sections visible on desktop viewport
- Cards in Section A are side-by-side on desktop
- Single column on mobile viewport
- All `data-testid` attributes present
