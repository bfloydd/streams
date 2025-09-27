import { App, Notice } from 'obsidian';
import { StreamAwareSliceService, SettingsAwareSliceService } from '../../shared/base-slice';
import { Stream } from '../../shared/types';
import { StreamSelectionModal } from './StreamSelectionModal';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { withErrorHandling, withAsyncErrorHandling, handleError } from '../../shared/error-handler';

export class StreamManagementService extends SettingsAwareSliceService {
    private globalIndicator: HTMLElement | null = null;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.createGlobalStreamIndicator();
        this.registerCommands();

        this.initialized = true;
    }

    cleanup(): void {
        this.removeGlobalStreamIndicator();
        this.initialized = false;
    }

    onStreamAdded(stream: Stream): void {
        this.updateGlobalStreamIndicator();
        eventBus.emit(EVENTS.STREAM_ADDED, stream, 'stream-management');
    }

    onStreamUpdated(stream: Stream): void {
        this.updateGlobalStreamIndicator();
        eventBus.emit(EVENTS.STREAM_UPDATED, stream, 'stream-management');
    }

    onStreamRemoved(streamId: string): void {
        // If the removed stream was active, clear the active stream
        if (this.getPluginSettings().activeStreamId === streamId) {
            this.setActiveStream(undefined);
        }
        this.updateGlobalStreamIndicator();
        eventBus.emit(EVENTS.STREAM_REMOVED, { streamId }, 'stream-management');
    }

    onActiveStreamChanged(streamId: string | undefined): void {
        this.updateGlobalStreamIndicator();
    }

    onSettingsChanged(settings: any): void {
        this.updateGlobalStreamIndicator();
        eventBus.emit(EVENTS.SETTINGS_CHANGED, settings, 'stream-management');
    }

    /**
     * Set the active stream
     */
    public setActiveStream = withErrorHandling((streamId: string | undefined, force: boolean = false): void => {
        const currentActiveStreamId = this.getPluginSettings().activeStreamId;
        
        if (currentActiveStreamId === streamId && !force) {
            return; // No change needed
        }

        // Update the settings
        const plugin = this.getPlugin() as any;
        plugin.settings.activeStreamId = streamId;
        
        // Save settings
        plugin.saveSettings();

        // Log the change
        if (streamId) {
            const stream = this.getStreams().find(s => s.id === streamId);
            this.log(`Active stream changed to: ${stream?.name || 'Unknown'} (${streamId})`);
        } else {
            this.log('Active stream cleared');
        }

        // Update the global indicator
        this.updateGlobalStreamIndicator();

        // Emit event for other services
        eventBus.emit(EVENTS.ACTIVE_STREAM_CHANGED, { streamId, previousStreamId: currentActiveStreamId }, 'stream-management');
    }, 'stream-management', 'setActiveStream');

    /**
     * Get the currently active stream
     */
    public getActiveStream(): Stream | undefined {
        const activeStreamId = this.getPluginSettings().activeStreamId;
        if (!activeStreamId) return undefined;
        return this.getStreams().find(s => s.id === activeStreamId);
    }

    /**
     * Show stream selection modal
     */
    public showStreamSelection = withErrorHandling((): void => {
        const modal = new StreamSelectionModal(
            this.getPlugin().app, 
            this.getStreams(), 
            async (selectedStream) => {
                if (selectedStream) {
                    this.setActiveStream(selectedStream.id, true);
                }
            }
        );
        modal.open();
    }, 'stream-management', 'showStreamSelection');

    private registerCommands(): void {
        const plugin = this.getPlugin();
        
        // Add command to select stream
        plugin.addCommand({
            id: 'streams-select-stream',
            name: 'Select active stream',
            callback: () => {
                this.showStreamSelection();
            }
        });

        // Add command to refresh global indicator
        plugin.addCommand({
            id: 'streams-refresh-global-indicator',
            name: 'Refresh global stream indicator',
            callback: () => {
                this.updateGlobalStreamIndicator();
            }
        });
    }

    private createGlobalStreamIndicator(): void {
        // Remove existing indicator if it exists
        this.removeGlobalStreamIndicator();

        // Create the global indicator
        this.globalIndicator = document.body.createDiv({
            cls: 'streams-global-indicator',
            text: this.getGlobalStreamIndicatorText()
        });

        // Add click handler to show stream selection
        this.globalIndicator.addEventListener('click', () => {
            this.showStreamSelection();
        });

        this.log('Global stream indicator created');
    }

    private removeGlobalStreamIndicator(): void {
        if (this.globalIndicator) {
            this.globalIndicator.remove();
            this.globalIndicator = null;
        }
    }

    private updateGlobalStreamIndicator(): void {
        if (!this.globalIndicator) return;

        this.globalIndicator.textContent = this.getGlobalStreamIndicatorText();
    }

    private getGlobalStreamIndicatorText(): string {
        const activeStream = this.getActiveStream();
        if (activeStream) {
            return `📅 ${activeStream.name}`;
        }
        return '📅 No Stream';
    }

    private getStreams(): Stream[] {
        const plugin = this.getPlugin() as any;
        return plugin.settings?.streams || [];
    }

    private getPluginSettings(): any {
        const plugin = this.getPlugin() as any;
        return plugin.settings || {};
    }

}
