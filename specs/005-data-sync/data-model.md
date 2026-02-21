# Data Model: Data Synchronization

**Feature**: 005-data-sync  
**Status**: Draft

## Overview

Aither is stateless (no database). All persistent data lives in flat files under `output/`.

## Sync Manifest

**File**: `output/.sync-manifest.json`

```json
{
  "lastSyncAt": "2026-02-21T14:30:00.000Z",
  "durationMs": 2340,
  "entities": {
    "courses": {
      "cm5abc123def456ghi": {
        "hash": "sha256:abc123...",
        "updatedAt": "2026-02-21T14:30:00.000Z",
        "outputPath": "output/seminars/gehaltsgespraech.html"
      }
    }
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `lastSyncAt` | ISO 8601 string | Timestamp of last successful sync |
| `durationMs` | number | Sync duration in milliseconds |
| `entities.courses.<id>.hash` | string | SHA-256 hash of serialized course data |
| `entities.courses.<id>.updatedAt` | string | When this entity was last synced |
| `entities.courses.<id>.outputPath` | string | Path to generated HTML file |

## Generated HTML Files

**Directory**: `output/seminars/<slug>.html`

Each course produces one HTML file, populated from a template with course-specific data.

## TypeScript Types

```typescript
interface SyncManifest {
  lastSyncAt: string;
  durationMs: number;
  entities: {
    courses: Record<string, EntityManifestEntry>;
  };
}

interface EntityManifestEntry {
  hash: string;
  updatedAt: string;
  outputPath: string;
}

interface SyncResult {
  success: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stats: {
    coursesTotal: number;
    coursesChanged: number;
    filesWritten: number;
    filesSkipped: number;
  };
  errors: string[];
}
```
