import { WorkspaceLeaf, MarkdownView, View } from 'obsidian';
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
     * Find the content container for a given leaf based on its view type
     * @param leaf The workspace leaf to find the container for
     * @returns The content container element, or null if not found
     */
    findContentContainer(leaf: WorkspaceLeaf): HTMLElement | null {
        const viewType = leaf.view.getViewType();
        let contentContainer: HTMLElement | null = null;
        
        if (viewType === 'markdown') {
            const markdownView = leaf.view as MarkdownView;
            contentContainer = markdownView.contentEl;
            
        } else if (viewType === CREATE_FILE_VIEW_TYPE || 
                   viewType === INSTALL_MELD_VIEW_TYPE || 
                   viewType === CREATE_FILE_VIEW_ENCRYPTED_TYPE) {
            const view = leaf.view as unknown as ViewWithContentEl;
            if (!view) {
                centralizedLogger.error(`View is null for viewType: ${viewType}`);
                return null;
            }
            contentContainer = view.contentEl;
            
        } else if (viewType === 'empty') {
            // For empty views, try to find the view-content element
            const viewContent = leaf.view.containerEl.querySelector('.view-content');
            if (viewContent) {
                contentContainer = viewContent as HTMLElement;
            } else {
                centralizedLogger.error('Could not find view-content for empty view');
                return null;
            }
        } else if (viewType === 'file-explorer') {
            // For file explorer, add to the main content area
            const mainContent = leaf.view.containerEl.querySelector('.nav-files-container') || 
                               leaf.view.containerEl.querySelector('.nav-files') ||
                               leaf.view.containerEl;
            contentContainer = mainContent as HTMLElement;

        } else {
            const view = leaf.view as unknown as ViewWithContentEl;
            if (!view) {
                centralizedLogger.error('View is null');
                return null;
            }
            contentContainer = view.contentEl;
        }
        
        return contentContainer;
    }

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
    }

    /**
     * Attach a component to the DOM in the appropriate location
     * @param component The component element to attach
     * @param leaf The workspace leaf to attach to
     * @param contentContainer The content container element
     * @returns True if attachment was successful, false otherwise
     */
    attachComponent(component: HTMLElement, leaf: WorkspaceLeaf, contentContainer: HTMLElement): boolean {
        // Add class to content container
        contentContainer.addClass('streams-markdown-view-content');
        
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
        
        if (viewHeader && viewHeader.parentElement) {
            // Insert after the view-header for this specific leaf
            viewHeader.parentElement.insertBefore(component, viewHeader.nextSibling);
        } else {
            // Fallback: attach to the leaf container itself
            leafContainer.insertBefore(component, leafContainer.firstChild);
        }

        return true;
    }
}

