import { WorkspaceLeaf } from 'obsidian';
import { LeafInspector } from '../../shared/interfaces';

/**
 * Service for inspecting workspace leaves
 * Follows Single Responsibility Principle - only handles leaf inspection logic
 */
export class LeafInspectionService implements LeafInspector {
    /**
     * Check if a leaf belongs to the main editor area (not sidebars)
     */
    isMainEditorLeaf(leaf: WorkspaceLeaf): boolean {
        const mainEditorArea = document.querySelector('.workspace-split.mod-vertical.mod-root');
        if (!mainEditorArea) {
            return false;
        }

        return mainEditorArea.contains(leaf.view.containerEl);
    }
}