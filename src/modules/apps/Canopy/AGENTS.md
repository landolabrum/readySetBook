# Product Engineer

Owns all files in `webapp/src/modules/apps/Canopy/`.

## Streaming rules
- Consume pipeline API only — never call MediaMTX directly from frontend code.
- Always surface `ctx.pipelineError` and `ctx.resolvedPlayableUrl` to the user.
- HLS `src` values come from the pipeline response (`hlsUrl`) — never construct URLs client-side.

## Device data
- Device status and capabilities come from `useAvailableStreamDevices` (Sprint 4: will migrate to `useFleetDevices`). Do not duplicate device-health logic in UI hooks.
- Show all devices in selectors; disable offline ones. Never silently filter out offline devices (hides fleet state from the operator).

## Boundaries
- Do NOT modify backend pipeline routes, stream worker code, or MediaMTX config.
- Coordinate with Platform Engineer when API request/response shapes change.

---

# Canopy Module Contribution Guide

## Overview
Canopy is the livestream overlay management application. It provides a visual editor for composing overlays (scoreboard, ticker, map, media, weather, etc.) that are pushed live to streaming endpoints.

## Architecture

### Directory Structure
```
Canopy/
├── context/
│   └── CanopyProvider.tsx      # SSE pool + React context for shared useCanopy() API
├── controller/
│   └── Canopy.tsx              # Main app shell (~325 lines after refactor)
├── hooks/
│   ├── useCanopy.ts            # Data layer: events, roster, overlays CRUD
│   ├── useCanopyViewState.tsx  # View-model: overlayTable, push/undo, selection
│   ├── useOverlayStore.ts      # LocalStorage-backed overlay state
│   └── ...                     # Stream, GPS, layout hooks
├── lib/
│   └── overlayRegistry.tsx     # Renderer functions per overlay type
├── models/
│   ├── canopyOverlayTypes.ts   # Thin barrel — re-exports everything from ./overlay/
│   ├── overlay/                # Modular overlay system (types, coerce, catalog, defaults, layout, field builders, card, media, dispatcher)
│   └── overlayModels.ts        # OVERLAY_MODELS config with defaultPayload/mergeData
├── utils/
│   ├── overlay-helpers.ts      # overlayDisplayLabel, transforms, guards
│   └── ...                     # API, dimension, geo helpers
└── views/
    ├── CanopyResizerContent/   # Extracted resizer layout component
    ├── CanopyMedia/            # Overlay render surface + engine
    ├── CanopyPanel/            # Event/stream selection panel
    └── CanopyView/             # Monitor, controls, per-type panels
```

### Data Flow
```
DB/API → useCanopy() → CanopyProvider (context)
                              ↓
                       useOverlayStore (localStorage)
                              ↓
                       useCanopyViewState (view-model)
                              ↓
                       overlayTable → UI (Source panel tags)
                              ↓
                       CanopyOverlayControls → per-type forms
                              ↓
                       CanopyMedia → overlayRegistry renderers
```

## Key Conventions

### Overlay Type Registration
When adding a new overlay type:
1. Add type to `OVERLAY_MODELS` in [overlayModels.ts](models/overlayModels.ts) with `label`, `defaultPos`, `defaultPayload()`, `mergeData()`
2. Add to `OVERLAY_TYPES` array in [models/overlay/catalog.ts](models/overlay/catalog.ts)
3. Add icon mapping in `overlayTypeIcon` in [useCanopyViewState.tsx](hooks/useCanopyViewState.tsx)
4. Create renderer in [overlayRegistry.tsx](lib/overlayRegistry.tsx)
5. Add control panel in [CanopyOverlayControls](views/CanopyView/views/CanopyOverlayControls/)

### Label Derivation
Use `overlayDisplayLabel(overlay)` from [overlay-helpers.ts](utils/overlay-helpers.ts) for consistent human-readable labels. Priority:
1. `title` field if non-empty string
2. Filename from `data.src` or `data.urls[0]` for media/share types
3. `OVERLAY_MODELS[type].label`
4. Fallback to type name

### State Management
- **Local edits**: `useOverlayStore` → localStorage under `canopy:overlays:<eventId>`
- **Server sync**: `useCanopy().saveOverlaysById()` pushes local → server
- **Live preview**: Toggle `showLive` to view server state vs local edits
- **Undo**: Revert local state to last-saved server state

### Form Field Builders
Per-type form fields are built in [models/overlay/](models/overlay/) — each type has its own file under `fields/`, `card/`, or `media/`. The dispatcher `overlayFieldsFor()` lives in [models/overlay/fieldsFor.ts](models/overlay/fieldsFor.ts). All public symbols are re-exported via [models/canopyOverlayTypes.ts](models/canopyOverlayTypes.ts) (barrel → `./overlay/index.ts`). Keep UI-specific builders separate from pure type schemas.

## Testing
1. Smoke test: Navigate to `/canopy`, create event, add each overlay type
2. Verify `overlayTable` shows meaningful labels for all types including media
3. Test push/undo flow
4. Test mobile layout breakpoint (<1100px)

## Known Issues
- SSE pool (`sseConnectionPool`) is outside React lifecycle; consider extracting to [lib/ssePool.ts](lib/ssePool.ts) for easier testing
- `CanopyOverlayControls` is 743 lines; split into per-type panels in future refactor
