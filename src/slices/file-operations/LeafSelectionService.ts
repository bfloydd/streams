import { App, WorkspaceLeaf, MarkdownView, normalizePath, TFile } from 'obsidian';
import { centralizedLogger } from '../../shared/CentralizedLogger';

/**
 * Service for selecting appropriate workspace leaves based on settings
 * Extracted from streamUtils.ts to eliminate code duplication and follow SRP
 */
export class LeafSelectionService {
    /**
     * Checks whether a workspace leaf is pinned.
     * Obsidian exposes this via the internal `pinned` property on the leaf.
     */
    private static isLeafPinned(leaf: WorkspaceLeaf): boolean {
        return (leaf as any).pinned === true;
    }

    /**
     * Checks whether a leaf belongs to the main editor area (rootSplit),
     * as opposed to left/right side panes.
     */
    private static isInMainEditorArea(app: App, leaf: WorkspaceLeaf): boolean {
        return leaf.getRoot() === app.workspace.rootSplit;
    }

    /**
     * Finds the next unpinned leaf in the main editor area that can be reused.
     * Mimics Obsidian's native behavior of selecting an existing tab rather
     * than always creating a new one. Only considers leaves in the main
     * editor area, never side panes.
     * @param app - Obsidian app instance
     * @param viewTypeFilter - Optional filter to check if a leaf's view type is suitable
     * @returns An unpinned leaf in the main area, or a new tab if none found
     */
    private static findNextUnpinnedLeaf(
        app: App,
        viewTypeFilter?: (viewType: string) => boolean
    ): WorkspaceLeaf | null {
        // Scan only main editor leaves for an unpinned candidate
        const candidates: WorkspaceLeaf[] = [];
        app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
            if (!this.isInMainEditorArea(app, leaf)) return;
            if (!this.isLeafPinned(leaf)) {
                if (!viewTypeFilter || viewTypeFilter(leaf.view.getViewType())) {
                    candidates.push(leaf);
                }
            }
        });

        if (candidates.length > 0) {
            return candidates[0];
        }

        // No unpinned leaf found in main area — create a new tab as last resort
        try {
            return app.workspace.getLeaf('tab');
        } catch (error) {
            centralizedLogger.error('Failed to create new leaf:', error);
            return null;
        }
    }

    /**
     * Selects the appropriate leaf based on reuseCurrentTab setting
     * @param app - Obsidian app instance
     * @param reuseCurrentTab - Whether to reuse the current tab
     * @param viewTypeFilter - Optional filter function to check if view type is suitable
     * @returns Selected leaf or null if creation failed
     */
    static selectLeaf(
        app: App,
        reuseCurrentTab: boolean,
        viewTypeFilter?: (viewType: string) => boolean
    ): WorkspaceLeaf | null {
        if (reuseCurrentTab) {
            return this.reuseCurrentLeaf(app);
        } else {
            return this.selectOrCreateLeaf(app, viewTypeFilter);
        }
    }

    /**
     * Reuses the current active leaf or creates a new one
     */
    private static reuseCurrentLeaf(app: App): WorkspaceLeaf | null {
        const activeLeaf = app.workspace.activeLeaf;
        if (activeLeaf && !this.isLeafPinned(activeLeaf) && this.isInMainEditorArea(app, activeLeaf)) {
            return activeLeaf;
        }
        
        // Active leaf is pinned or in a side pane — find the next unpinned leaf instead
        return this.findNextUnpinnedLeaf(app);
    }

    /**
     * Selects an existing suitable leaf or creates a new one
     */
    private static selectOrCreateLeaf(
        app: App,
        viewTypeFilter?: (viewType: string) => boolean
    ): WorkspaceLeaf | null {
        const activeLeaf = app.workspace.activeLeaf;
        
        if (activeLeaf && !this.isLeafPinned(activeLeaf) && this.isInMainEditorArea(app, activeLeaf)) {
            const viewType = activeLeaf.view.getViewType();
            if (!viewTypeFilter || viewTypeFilter(viewType)) {
                return activeLeaf;
            }
        }
        
        // Active leaf is pinned, filtered out, or in a side pane — find the next unpinned leaf
        return this.findNextUnpinnedLeaf(app, viewTypeFilter);
    }

    /**
     * Finds an existing leaf with the specified file, or creates a new one
     * @param app - Obsidian app instance
     * @param file - File to find or open
     * @param reuseCurrentTab - Whether to reuse current tab if file not found
     * @returns Selected leaf or null if creation failed
     */
    static selectLeafForFile(
        app: App,
        file: TFile,
        reuseCurrentTab: boolean
    ): WorkspaceLeaf | null {
        // First, try to find existing leaf with this file (only in main editor area)
        const existingLeaf = app.workspace.getLeavesOfType('markdown')
            .find(leaf => {
                try {
                    if (!this.isInMainEditorArea(app, leaf)) return false;
                    const view = leaf.view as MarkdownView;
                    const viewFile = view?.file;
                    if (!viewFile || !file) return false;
                    
                    const viewPath = normalizePath(viewFile.path);
                    const filePath = normalizePath(file.path);
                    return viewPath === filePath;
                } catch (e) {
                    return false;
                }
            });

        if (existingLeaf) {
            return existingLeaf;
        }

        // If not found and reuseCurrentTab is enabled, try to reuse current leaf
        if (reuseCurrentTab) {
            const activeLeaf = app.workspace.activeLeaf;
            if (activeLeaf && !this.isLeafPinned(activeLeaf) && this.isInMainEditorArea(app, activeLeaf)) {
                return activeLeaf;
            }
        }

        // Find the next unpinned leaf in the main area, or create a new tab as last resort
        return this.findNextUnpinnedLeaf(app);
    }
}

