# ADR-0002: Ribbon click behavior

**Date:** 2026-03-25  
**Status:** Accepted  
**Affects:** `RibbonService.ts`, `OpenTodayStreamCommand.ts`, `OpenTodayPrimaryStreamCommand.ts`

## Context

Users interact with stream ribbon icons to quickly open a stream's daily note. Before this change, every click behaved identically — there was no way to control *how* the note opened (reuse a tab vs. open a new one) at click time. Users who wanted to open the same stream in a second tab had no mechanism to do so from the ribbon.

Standard Obsidian and browser conventions use **Ctrl+click** (or **Cmd+click** on macOS) to force-open a link in a new tab.

## Decision

### Normal click (no modifier)

Follows the reuse-first strategy defined in [ADR-0001](0001-leaf-selection-behavior.md):

1. Reuse the active leaf if it's unpinned and in the main editor area
2. Otherwise find an existing unpinned leaf in the main editor area
3. Create a new tab only as a last resort

This respects the user's `reuseCurrentTab` setting and keeps tab count manageable.

### Ctrl+click / Cmd+click

Always opens in a **new tab**, bypassing all reuse logic:

1. The ribbon callback captures the `MouseEvent`
2. If `evt.ctrlKey` (Windows/Linux) or `evt.metaKey` (macOS) is `true`, a fresh leaf is created via `app.workspace.getLeaf('tab')`
3. This leaf is passed as `targetLeaf` to the command, which forwards it to `openStreamDate()`
4. When `targetLeaf` is provided, `LeafSelectionService` is not consulted at all

### Implementation

Both ribbon callbacks (`createAllStreamsIcon` and `createStreamIcons`) were updated from `() => { ... }` to `(evt: MouseEvent) => { ... }`. The `OpenTodayStreamCommand` constructor was extended with an optional `targetLeaf` parameter (matching `OpenTodayPrimaryStreamCommand`, which already had one).

## Consequences

- **Matches platform conventions.** Ctrl/Cmd+click for "open in new tab" is muscle memory for most users.
- **No new settings required.** The modifier key approach is discoverable and doesn't add UI complexity.
- **Commands (palette) are unaffected.** Only ribbon icon clicks receive the mouse event; command palette invocations continue to use the standard reuse-first strategy.
