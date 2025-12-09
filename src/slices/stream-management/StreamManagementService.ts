import { App, Notice } from 'obsidian';
import { StreamAwareSliceService, SettingsAwareSliceService } from '../../shared/BaseSlice';
import { Stream, StreamsSettings } from '../../shared/types';
import { StreamSelectionModal } from './StreamSelectionModal';
import { eventBus, EVENTS } from '../../shared/EventBus';
import { withErrorHandling, withAsyncErrorHandling, handleError } from '../../shared/ErrorHandler';
import { GlobalStreamIndicator } from '../../shared/GlobalStreamIndicator';

export class StreamManagementService extends SettingsAwareSliceService {
    // private globalIndicator: GlobalStreamIndicator; // Global indicator removed

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Global indicator removed
        // this.globalIndicator = new GlobalStreamIndicator();
        // this.globalIndicator.create(() => this.showStreamSelection());

        this.registerCommands();

        this.initialized = true;
    }

    cleanup(): void {
        // this.globalIndicator?.destroy();
        this.initialized = false;
    }

    onStreamAdded(stream: Stream): void {
        eventBus.emit(EVENTS.STREAM_ADDED, stream, 'stream-management');
    }

    onStreamUpdated(stream: Stream): void {
        eventBus.emit(EVENTS.STREAM_UPDATED, stream, 'stream-management');
    }

    onStreamRemoved(streamId: string): void {
        // Active stream check removed
        eventBus.emit(EVENTS.STREAM_REMOVED, { streamId }, 'stream-management');
    }

    // onActiveStreamChanged removed

    onSettingsChanged(settings: StreamsSettings): void {
        eventBus.emit(EVENTS.SETTINGS_CHANGED, settings, 'stream-management');
    }

    /**
     * Show stream selection modal
     */
    public showStreamSelection = withErrorHandling((): void => {
        const modal = new StreamSelectionModal(
            this.getPlugin().app,
            this.getStreams(),
            async (selectedStream) => {
                // Previously set active stream, now just emits event or navigates?
                // For now, if someone calls this, maybe they want to open a stream.
                // But setActiveStream is gone.
                // We'll leave it empty or trigger navigation if we can contextually.
                // For now, removing the setActiveStream call.
                if (selectedStream) {
                    // TODO: Decide what 'selecting a stream' does globally if anything.
                    // Maybe nothing. This modal might be obsolete or need repurposing.
                }
            }
        );
        modal.open();
    }, 'stream-management', 'showStreamSelection');

    private registerCommands(): void {
        const plugin = this.getPlugin();

        // No commands currently registered
    }

}
