import { WorkspaceLeaf, MarkdownView, View, Platform } from 'obsidian';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { CREATE_FILE_VIEW_TYPE } from '../file-operations/CreateFileView';
import { INSTALL_MELD_VIEW_TYPE } from '../file-operations/InstallMeldView';
import { CREATE_FILE_VIEW_ENCRYPTED_TYPE } from '../file-operations/CreateFileViewEncrypted';

// Extended View interface for views with contentEl property
interface ViewWithContentEl extends View {
    contentEl: HTMLElement;
}

/**
 * Service for detecting view types and finding content containers
 * Extracted from StreamsBarComponent to follow Single Responsibility Principle
 */
export class ViewContainerService {
    /**
     * Check if a leaf is in the main editor area (not a sidebar)
     * @param leaf The workspace leaf to check
     * @returns True if the leaf is in the main editor area
     */
    isMainEditorLeaf(leaf: WorkspaceLeaf): boolean {
        const mainEditorArea = document.querySelector('.workspace-split.mod-vertical.mod-root');
        return mainEditorArea !== null && mainEditorArea.contains(leaf.view.containerEl);
    }

    /**
     * Remove existing components with the given class name from a leaf
     * @param leaf The workspace leaf to clean up
     * @param className The class name to search for
     */
    removeExistingComponents(leaf: WorkspaceLeaf, className: string): void {
        const leafContainer = leaf.view.containerEl;
        const existingComponents = leafContainer.querySelectorAll(className);
        existingComponents.forEach(component => {
            component.remove();
        });
        
        leafContainer.removeClass('streams-leaf-active');
    }

    /**
     * Attach a component to the DOM in the appropriate location
     * @param component The component element to attach
     * @param leaf The workspace leaf to attach to
     * @returns True if attachment was successful, false otherwise
     */
    attachComponent(component: HTMLElement, leaf: WorkspaceLeaf): boolean {
        // Add state class to the root leaf container to reliably target layout CSS
        leaf.view.containerEl.addClass('streams-leaf-active');

        // Only add the calendar component if we're in the main editor area
        if (!this.isMainEditorLeaf(leaf)) {
            // Don't add calendar component to sidebars or other panes
            component.remove();
            return false;
        }

        // Apply standard calendar component styling
        component.addClass('streams-bar-component');

        // Attach directly to the leaf's container element to ensure it stays with the specific editor window
        const leafContainer = leaf.view.containerEl;

        // Find the view-header within this specific leaf
        const viewHeader = leafContainer.querySelector('.view-header');

        if (viewHeader) {
            // Append inside the view-header for all platforms (mobile, tablet, desktop)
            // to ensure consistent placement across the app
            viewHeader.appendChild(component);
        } else {
            // Fallback: attach to the leaf container itself
            leafContainer.insertBefore(component, leafContainer.firstChild);
        }

        return true;
    }
}

