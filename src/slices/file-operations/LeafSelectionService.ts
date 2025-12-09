import { App, WorkspaceLeaf, MarkdownView, normalizePath, TFile } from 'obsidian';
import { centralizedLogger } from '../../shared/CentralizedLogger';

/**
 * Service for selecting appropriate workspace leaves based on settings
 * Extracted from streamUtils.ts to eliminate code duplication and follow SRP
 */
export class LeafSelectionService {
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
        if (activeLeaf) {
            return activeLeaf;
        }
        
        try {
            return app.workspace.getLeaf('tab');
        } catch (error) {
            centralizedLogger.error('Failed to create new leaf:', error);
            return null;
        }
    }

    /**
     * Selects an existing suitable leaf or creates a new one
     */
    private static selectOrCreateLeaf(
        app: App,
        viewTypeFilter?: (viewType: string) => boolean
    ): WorkspaceLeaf | null {
        const activeLeaf = app.workspace.activeLeaf;
        
        if (activeLeaf) {
            const viewType = activeLeaf.view.getViewType();
            if (!viewTypeFilter || viewTypeFilter(viewType)) {
                return activeLeaf;
            }
        }
        
        try {
            return app.workspace.getLeaf('tab');
        } catch (error) {
            centralizedLogger.error('Failed to create new leaf:', error);
            return null;
        }
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
        // First, try to find existing leaf with this file
        const existingLeaf = app.workspace.getLeavesOfType('markdown')
            .find(leaf => {
                try {
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
            if (activeLeaf) {
                return activeLeaf;
            }
        }

        // Create a new leaf
        try {
            return app.workspace.getLeaf('tab');
        } catch (error) {
            centralizedLogger.error('Failed to create new leaf:', error);
            return null;
        }
    }
}

