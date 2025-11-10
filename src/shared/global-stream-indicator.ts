import { Stream } from './types';

/**
 * Manages the global stream indicator UI component
 * Handles creation, updates, and cleanup of the DOM element
 */
export class GlobalStreamIndicator {
    private element: HTMLElement | null = null;
    private onClickCallback?: () => void;

    /**
     * Create the global stream indicator element
     */
    create(onClick?: () => void): void {
        // Remove existing indicator if it exists
        this.destroy();

        this.onClickCallback = onClick;

        // Create the global indicator
        this.element = document.body.createDiv({
            cls: 'streams-global-indicator',
            text: this.getIndicatorText(undefined)
        });

        // Add click handler if provided
        if (this.onClickCallback) {
            this.element.addEventListener('click', this.onClickCallback);
        }
    }

    /**
     * Update the indicator with the current active stream
     */
    update(activeStream: Stream | undefined): void {
        if (!this.element) return;

        this.element.textContent = this.getIndicatorText(activeStream);
    }

    /**
     * Remove and cleanup the indicator
     */
    destroy(): void {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        this.onClickCallback = undefined;
    }

    /**
     * Check if the indicator is currently displayed
     */
    isVisible(): boolean {
        return this.element !== null;
    }

    /**
     * Get the text to display based on the active stream
     */
    private getIndicatorText(activeStream: Stream | undefined): string {
        if (activeStream) {
            return `📅 ${activeStream.name}`;
        }
        return '📅 No Stream';
    }
}