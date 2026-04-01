# Data Model: 007 — Dashboard Design

**Date**: 2026-03-25 | **Branch**: `007-dashboard-design`

## Overview

This feature introduces no new data entities or persistence. All data is
fetched from existing sources (Hemera API + local filesystem). This document
describes the data shapes consumed by the dashboard components.

## Data Sources (read-only)

### ServiceCourseDetail (from Hemera API)

Existing type — no changes.

```typescript
interface ServiceCourseDetail {
  id: string
  title: string
  slug: string
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  startDate: string | null
  endDate: string | null
  participants: ServiceParticipant[]
}
```

### ServiceParticipant (from Hemera API)

Existing type — no changes.

```typescript
interface ServiceParticipant {
  participationId: string
  userId: string
  name: string | null
  status: string
  preparationIntent: string | null
  desiredResults: string | null
  lineManagerProfile: string | null
  preparationCompletedAt: string | null
}
```

### SlideStatus (local filesystem)

Existing type — no changes.

```typescript
interface SlideStatus {
  status: "generated" | "not-generated"
  slideCount: number
  lastUpdated: string | null
  files: string[]
  courseId: string | null
}
```

## New Types

### Design Tokens (UI configuration)

```typescript
/** Hemera color palette for Aither UI */
interface HemeraColors {
  marsala: string       // #884143
  marsalaLight: string  // #A05A5C
  marsalaDark: string   // #6B3234
  bronze: string        // #926A49
  rosyBrown: string     // #bc8f8f
  beige: string         // #EBE2D3
  lightBlack: string    // #2D2D2D
  white: string         // #FFFFFF
  infoMain: string      // #5B9A8B (sage green)
  lightGray: string     // #E5E5E5
}

/** Hemera spacing tokens */
interface HemeraSpacing {
  sectionPy: { xs: number; md: number }         // { xs: 6, md: 10 }
  sectionPyCompact: { xs: number; md: number }   // { xs: 4, md: 6 }
  containerMaxWidth: "lg"
}
```

### Component Props

```typescript
/** Section A — Course Information Card */
interface CourseCardProps {
  course: ServiceCourseDetail
}

/** Section A — Material Status Card */
interface MaterialCardProps {
  slideStatus: SlideStatus
}

/** Section B — Participant Preparations List */
interface ParticipantsListProps {
  participants: ServiceParticipant[]
}

/** Section B — Course Slides List */
interface SlidesListProps {
  slideStatus: SlideStatus
}

/** Section C — Steuerung Cards (no props — self-contained client component) */
// EndpointStatus component reused with visual restructuring
```

## State Transitions

No state transitions — all data is fetched once at SSR time and rendered
statically. Client components (`EndpointStatus`, `SlideGenerateButton`)
manage their own internal state as before.

## Validation Rules

No new validation — existing Zod schemas in `src/lib/hemera/schemas.ts`
validate all API responses before they reach dashboard components.
