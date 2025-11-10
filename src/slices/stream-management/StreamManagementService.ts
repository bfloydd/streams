import { App, Notice } from 'obsidian';
import { StreamAwareSliceService, SettingsAwareSliceService } from '../../shared/base-slice';
import { Stream, StreamsSettings } from '../../shared/types';
import { StreamSelectionModal } from './StreamSelectionModal';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { withErrorHandling, withAsyncErrorHandling, handleError } from '../../shared/error-handler';
import { GlobalStreamIndicator } from '../../shared/global-stream-indicator';

export class StreamManagementService extends SettingsAwareSliceService {
    private globalIndicator: GlobalStreamIndicator;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.globalIndicator = new GlobalStreamIndicator();
        this.globalIndicator.create(() => this.showStreamSelection());
        this.registerCommands();

        this.initialized = true;
    }

    cleanup(): void {
        this.globalIndicator?.destroy();
        this.initialized = false;
    }

    onStreamAdded(stream: Stream): void {
        this.globalIndicator.update(this.getActiveStream());
        eventBus.emit(EVENTS.STREAM_ADDED, stream, 'stream-management');
    }

    onStreamUpdated(stream: Stream): void {
        this.globalIndicator.update(this.getActiveStream());
        eventBus.emit(EVENTS.STREAM_UPDATED, stream, 'stream-management');
    }

    onStreamRemoved(streamId: string): void {
        // If the removed stream was active, clear the active stream
        if (this.getPluginSettings().activeStreamId === streamId) {
            void this.setActiveStream(undefined);
        }
        this.globalIndicator.update(this.getActiveStream());
        eventBus.emit(EVENTS.STREAM_REMOVED, { streamId }, 'stream-management');
    }

    onActiveStreamChanged(streamId: string | undefined): void {
        this.globalIndicator.update(this.getActiveStream());
    }

    onSettingsChanged(settings: StreamsSettings): void {
        this.globalIndicator.update(this.getActiveStream());
        eventBus.emit(EVENTS.SETTINGS_CHANGED, settings, 'stream-management');
    }

    /**
     * Set the active stream
     */
    public setActiveStream = withAsyncErrorHandling(async (streamId: string | undefined, force: boolean = false): Promise<void> => {
        const currentActiveStreamId = this.getPluginSettings().activeStreamId;
        
        if (currentActiveStreamId === streamId && !force) {
            return; // No change needed
        }

        // Update the settings
        const plugin = this.getPlugin();
        plugin.settings.activeStreamId = streamId;
        
        // Save settings
        await plugin.saveSettings();

        // Log the change
        if (streamId) {
            const stream = this.getStreams().find(s => s.id === streamId);
            this.log(`Active stream changed to: ${stream?.name || 'Unknown'} (${streamId})`);
        } else {
            this.log('Active stream cleared');
        }

        // Update the global indicator
        this.globalIndicator.update(this.getActiveStream());

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
                    await this.setActiveStream(selectedStream.id, true);
                }
            }
        );
        modal.open();
    }, 'stream-management', 'showStreamSelection');

    private registerCommands(): void {
        const plugin = this.getPlugin();

        // No commands currently registered
    }

    private getStreams(): Stream[] {
        const plugin = this.getPlugin();
        return plugin.settings?.streams || [];
    }

    private getPluginSettings(): StreamsSettings {
        const plugin = this.getPlugin();
        return plugin.settings;
    }

}
