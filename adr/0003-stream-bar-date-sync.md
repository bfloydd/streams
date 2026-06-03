# ADR-0003: Stream bar date synchronization on external navigation

**Date:** 2026-03-25  
**Status:** Accepted  
**Affects:** `StreamsBarComponent.ts`

## Context

The stream bar displays the currently viewed date and provides calendar navigation within a stream. When a user opens a stream file via the plugin (ribbon icon, command palette, calendar click), the plugin explicitly calls `DateStateManager.setCurrentDate()` as part of the `openStreamDate()` flow, keeping the bar in sync.

However, users can also navigate to stream files through **external** means:

- Clicking a file in the file explorer
- Following an internal link from another note
- Using Obsidian's Quick Switcher
- Navigating browser history (back/forward)

In these cases, the plugin's `openStreamDate()` is never called. The `StreamsBarComponent`'s `file-open` handler detected the correct stream via `updateStreamContext()`, but **never extracted the date from the filename**. This left the stream bar showing a stale date from whatever was previously viewed.

## Decision

`updateStreamContext()` now always extracts the date from the opened file's basename when the file is identified as belonging to a stream. The date is parsed from the `YYYY-MM-DD` prefix pattern and pushed to `DateStateManager.setCurrentDate()`.

```typescript
// Extract date from filename (e.g., "2026-03-25" from "2026-03-25.md")
const match = file.basename.match(/^\d{4}-\d{2}-\d{2}/);
if (match) {
    const [year, month, day] = match[0].split('-').map(n => parseInt(n, 10));
    this.dateStateManager.setCurrentDate(new Date(year, month - 1, day));
}
```

This runs on every `file-open` event where the file matches a stream, regardless of how the navigation was initiated.

## Consequences

- **Stream bar stays in sync** regardless of how the user navigated to the file.
- **Calendar highlights the correct date**, enabling adjacent-day navigation from the right starting point.
- **No redundant updates** — `DateStateManager` already deduplicates if the date hasn't changed, so plugin-initiated navigation (which also calls `setCurrentDate`) does not cause double renders.
- **Assumes `YYYY-MM-DD` prefix** in filenames. Files that belong to a stream folder but don't follow this naming convention will not update the date display.
