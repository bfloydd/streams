import { Component, setIcon, App } from 'obsidian';
import { Stream } from '../../shared/types';
import { OpenStreamDateCommand } from '../file-operations/OpenStreamDateCommand';
import { DateStateManager } from '../../shared/DateStateManager';
import { centralizedLogger } from '../../shared/CentralizedLogger';

interface PluginInterface {
    settings?: {
        primaryStreamId?: string | null;
    };
}

/**
 * Component responsible for stream selection dropdown
 * Handles stream dropdown UI, selection, and navigation
 */
export class StreamSelector extends Component {
    onunload(): void {
        // Cleanup handled by parent component
        // This method exists for Component interface compliance
    }
    private dropdown: HTMLElement;
    private streams: Stream[];
    private activeStreamId: string;
    private app: App;
    private plugin: PluginInterface | null;
    private reuseCurrentTab: boolean;
    private dateStateManager: DateStateManager;
    private onStreamSelected?: (stream: Stream) => void;

    constructor(
        dropdown: HTMLElement,
        streams: Stream[],
        activeStreamId: string,
        app: App,
        plugin: PluginInterface | null,
        reuseCurrentTab: boolean,
        dateStateManager: DateStateManager,
        onStreamSelected?: (stream: Stream) => void
    ) {
        super();
        this.dropdown = dropdown;
        this.streams = streams;
        this.activeStreamId = activeStreamId;
        this.app = app;
        this.plugin = plugin;
        this.reuseCurrentTab = reuseCurrentTab;
        this.dateStateManager = dateStateManager;
        this.onStreamSelected = onStreamSelected;
    }

    /**
     * Populate the streams dropdown with available streams
     */
    populateStreamsDropdown(): void {
        if (!this.dropdown) return;

        this.dropdown.empty();

        const primaryStreamId = this.plugin?.settings?.primaryStreamId ?? null;

        // Filter out disabled streams
        const enabledStreams = this.streams.filter(stream => !stream.disabled);

        enabledStreams.forEach(stream => {
            const streamItem = this.dropdown.createDiv('streams-bar-stream-item');

            const isSelected = stream.id === this.activeStreamId;
            if (isSelected) {
                streamItem.addClass('streams-bar-stream-item-selected');
            }

            const streamIcon = streamItem.createDiv('streams-bar-stream-item-icon');
            setIcon(streamIcon, stream.icon);
            const streamName = streamItem.createDiv('streams-bar-stream-item-name');
            streamName.setText(stream.name);

            // Subtle indicator for the primary stream (configured in settings)
            if (primaryStreamId && stream.id === primaryStreamId) {
                streamItem.addClass('streams-bar-stream-item-primary');
                const primaryIndicator = streamItem.createDiv('streams-bar-stream-item-primary-indicator');
                primaryIndicator.setAttribute('title', 'Primary stream');
                primaryIndicator.setAttribute('aria-label', 'Primary stream');
            }

            // Add encryption icon if stream is encrypted
            if (stream.encryptThisStream) {
                const encryptionIcon = streamItem.createDiv('streams-bar-stream-item-encryption');
                setIcon(encryptionIcon, 'lock');
                encryptionIcon.setAttribute('title', 'Encrypted stream');
                encryptionIcon.setAttribute('aria-label', 'Encrypted stream');
            }

            if (isSelected) {
                const checkmark = streamItem.createDiv('streams-bar-stream-item-checkmark');
                setIcon(checkmark, 'check');
            }

            streamItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectStream(stream);
            });
        });

        // Force a reflow on mobile devices to ensure the dropdown updates immediately
        if (this.dropdown) {
            // Trigger a reflow to ensure the changes are visible
            this.dropdown.offsetHeight;
        }
    }

    /**
     * Update the streams list
     */
    updateStreams(streams: Stream[]): void {
        this.streams = streams;
        this.populateStreamsDropdown();

        // Force immediate DOM update for mobile devices
        requestAnimationFrame(() => {
            this.dropdown?.offsetHeight;
        });
    }

    /**
     * Update the active stream ID
     */
    updateActiveStreamId(activeStreamId: string): void {
        this.activeStreamId = activeStreamId;
        this.populateStreamsDropdown();
    }

    /**
     * Select a stream and navigate to it
     */
    private async selectStream(stream: Stream): Promise<void> {
        this.hide();

        // Update the plugin's active stream - REMOVED
        // if (this.plugin) {
        //    await this.plugin.setActiveStream(stream.id, true, true);
        // }

        // Notify parent component
        if (this.onStreamSelected) {
            this.onStreamSelected(stream);
        } else {
            this.navigateToStreamDailyNote(stream);
        }
    }

    /**
     * Navigate to the stream's daily note for the current date
     */
    private async navigateToStreamDailyNote(stream: Stream): Promise<void> {
        try {
            const state = this.dateStateManager.getState();
            const targetDate = state.currentDate;

            const command = new OpenStreamDateCommand(this.app, stream, targetDate, this.reuseCurrentTab);
            await command.execute();
        } catch (error) {
            centralizedLogger.error('Error navigating to stream daily note:', error);
        }
    }

    /**
     * Show the dropdown
     */
    show(): void {
        if (this.dropdown) {
            this.dropdown.removeClass('streams-bar-dropdown-hidden');
            this.dropdown.addClass('streams-bar-dropdown-visible');
            this.dropdown.addClass('streams-dropdown--visible');
        }
    }

    /**
     * Hide the dropdown
     */
    hide(): void {
        if (this.dropdown) {
            this.dropdown.addClass('streams-bar-dropdown-hidden');
            this.dropdown.removeClass('streams-bar-dropdown-visible');
            this.dropdown.removeClass('streams-dropdown--visible');
        }
    }

    /**
     * Check if dropdown is visible
     */
    isVisible(): boolean {
        return this.dropdown && !this.dropdown.classList.contains('streams-bar-dropdown-hidden');
    }

    /**
     * Toggle dropdown visibility
     */
    toggle(): void {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    }
}

