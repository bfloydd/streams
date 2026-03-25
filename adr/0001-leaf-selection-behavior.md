# ADR-0001: Leaf selection behavior for stream navigation

**Date:** 2026-03-25  
**Status:** Accepted  
**Affects:** `LeafSelectionService.ts`, `RibbonService.ts`, `OpenTodayStreamCommand.ts`

## Context

When a user clicks a ribbon icon (or runs a command) to open a stream's daily note, the plugin must decide *which* workspace tab (leaf) to open the file in. Obsidian's workspace has three areas:

- **Main editor area** (`workspace.rootSplit`) — the central pane(s) where notes are edited
- **Left sidebar** (`workspace.leftSplit`) — file explorer, bookmarks, etc.
- **Right sidebar** (`workspace.rightSplit`) — backlinks, outgoing links, etc.

Prior to this decision, the plugin had several issues:

1. **Pinned tabs were overwritten** — clicking a ribbon icon while a pinned tab was active would load the stream note into that pinned tab, violating user intent.
2. **New tabs were always created** — when the active tab couldn't be reused (e.g., it was pinned), the plugin created a brand-new tab rather than reusing an existing unpinned one, leading to tab proliferation.
3. **Side panes could be targeted** — the leaf selection logic didn't distinguish between main editor leaves and sidebar leaves, so a stream note could open inside a sidebar panel.

## Decision

### 1. Never navigate into pinned tabs

All leaf selection paths check `(leaf as any).pinned === true` before reusing a leaf. If the active leaf is pinned, it is skipped entirely.

### 2. Prefer reusing an existing unpinned tab over creating a new one

When the active leaf can't be used (pinned or in a side pane), `findNextUnpinnedLeaf()` scans the workspace for the first unpinned, eligible leaf in the main editor area. A new tab is only created as a last resort when no candidate is found.

### 3. Restrict all leaf selection to the main editor area

Every leaf candidate is checked via `leaf.getRoot() === app.workspace.rootSplit`. Leaves in left/right sidebars are never selected for navigation. This applies to:

- `findNextUnpinnedLeaf()` — only scans main editor leaves
- `reuseCurrentLeaf()` — won't reuse the active leaf if it's in a sidebar
- `selectOrCreateLeaf()` — same guard
- `selectLeafForFile()` — won't match existing leaves in sidebars

### 4. Ctrl/Cmd+click forces a new tab

Ribbon icon callbacks capture the `MouseEvent`. When `ctrlKey` (Windows/Linux) or `metaKey` (macOS) is held, a fresh leaf is created via `app.workspace.getLeaf('tab')` and passed as `targetLeaf`, bypassing all reuse logic. This matches standard Obsidian/browser conventions.

## Leaf selection priority

For a normal click, the selection order is:

1. **Active leaf** — if it's unpinned, in the main editor area, and passes any view-type filter
2. **Existing leaf with same file** — (for `selectLeafForFile` only) if already open in the main editor
3. **Next unpinned leaf** — first unpinned leaf found in the main editor area
4. **New tab** — created via `getLeaf('tab')` as a last resort

For Ctrl/Cmd+click:

1. **New tab** — always, via `getLeaf('tab')` passed as `targetLeaf`

## Consequences

- **Pinned tabs are always respected.** Users can pin a tab and know it won't be overwritten by ribbon navigation.
- **Tab count stays manageable.** Reusing unpinned tabs prevents accumulation of redundant tabs.
- **Sidebar integrity is preserved.** File explorer, backlinks, and other sidebar views are never replaced with stream content.
- **Ctrl+click provides an escape hatch.** Users who *do* want a new tab can explicitly request one.
- **Relies on internal API.** The `pinned` property on `WorkspaceLeaf` is not part of Obsidian's public TypeScript API. This is a commonly used internal property but could change in future Obsidian versions.
