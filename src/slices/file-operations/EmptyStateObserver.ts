import { WorkspaceLeaf } from 'obsidian';

/**
 * Manages MutationObserver for hiding empty state elements in views
 * Extracted from CreateFileView to follow Single Responsibility Principle
 */
export class EmptyStateObserver {
    private observer: MutationObserver | null = null;
    private leaf: WorkspaceLeaf;

    constructor(leaf: WorkspaceLeaf) {
        this.leaf = leaf;
    }

    /**
     * Start observing and hiding empty state elements
     */
    start(): void {
        const hideEmptyStates = () => {
            const emptyStates = this.leaf.view.containerEl.querySelectorAll('.empty-state, .empty-state-container');
            emptyStates.forEach(el => {
                const htmlEl = el as HTMLElement;
                htmlEl.addClass('streams-empty-state-hidden');
            });
        };
        
        // Hide them immediately
        hideEmptyStates();
        
        // Set up a MutationObserver to hide them if they get recreated
        this.observer = new MutationObserver(() => {
            hideEmptyStates();
        });
        
        this.observer.observe(this.leaf.view.containerEl, {
            childList: true,
            subtree: true,
            attributes: false
        });
    }

    /**
     * Stop observing and clean up
     */
    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

