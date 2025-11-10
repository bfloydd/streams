import { PluginAwareSliceService } from '../../shared/base-slice';
import { Stream, StreamsSettings } from '../../shared/types';
import { StreamsAPI, StreamInfo, PluginVersion } from './StreamsAPI';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { withErrorHandling } from '../../shared/error-handler';
import { DateUtils } from '../../shared/utils/DateUtils';
import { FileUtils } from '../../shared/utils/FileUtils';

export class APIService extends PluginAwareSliceService implements StreamsAPI {
    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.initialized = true;
    }

    cleanup(): void {
        this.initialized = false;
    }

    // PUBLIC API METHODS - Available to other plugins
    // ============================================================================

    /**
     * Get all available streams
     * @returns Array of all configured streams
     */
    public getStreams(): Stream[] {
        return [...super.getStreams()];
    }

    /**
     * Get a specific stream by ID
     * @param streamId The unique identifier of the stream
     * @returns The stream if found, null otherwise
     */
    public getStream(streamId: string): Stream | null {
        const streams = this.getStreams();
        return streams.find(stream => stream.id === streamId) || null;
    }

    /**
     * Get the currently active stream
     * @returns The active stream if set, null otherwise
     */
    public getActiveStream(): Stream | null {
        const plugin = this.getPlugin();
        const activeStreamId = plugin.settings?.activeStreamId;
        
        if (!activeStreamId) {
            return null;
        }
        
        const activeStream = this.getStream(activeStreamId);
        if (!activeStream) {
            // Clear invalid active stream ID
            this.log(`Invalid active stream ID found: ${activeStreamId}, clearing it`);
            plugin.settings.activeStreamId = undefined;
            plugin.saveSettings();
            return null;
        }
        
        return activeStream;
    }

    /**
     * Generic stream filtering function
     * @param predicate Function to test each stream
     * @returns Array of streams that pass the predicate
     */
    private filterStreams(predicate: (stream: Stream) => boolean): Stream[] {
        return this.getStreams().filter(predicate);
    }

    /**
     * Get streams that match a specific folder path
     * @param folderPath The folder path to search for
     * @returns Array of streams that match the folder path
     */
    public getStreamsByFolder(folderPath: string): Stream[] {
        if (!folderPath) return [];

        return this.filterStreams(stream => {
            const streamFolder = FileUtils.normalizePath(stream.folder);
            const searchFolder = FileUtils.normalizePath(folderPath);

            return streamFolder === searchFolder ||
                   streamFolder.startsWith(searchFolder + '/') ||
                   searchFolder.startsWith(streamFolder + '/');
        });
    }

    /**
     * Get streams that have a specific icon
     * @param icon The icon to search for
     * @returns Array of streams with the specified icon
     */
    public getStreamsByIcon(icon: string): Stream[] {
        if (!icon) return [];

        return this.filterStreams(stream => stream.icon === icon);
    }

    /**
     * Get streams that are enabled for ribbon display
     * @returns Array of streams that show in the ribbon
     */
    public getRibbonStreams(): Stream[] {
        return this.filterStreams(stream => stream.showTodayInRibbon && !stream.disabled);
    }

    /**
     * Get streams that have commands enabled
     * @returns Array of streams with commands enabled
     */
    public getCommandStreams(): Stream[] {
        return this.filterStreams(stream => stream.addCommand && !stream.disabled);
    }

    /**
     * Get the stream that contains a specific file
     * @param filePath The file path to check
     * @returns The stream that contains this file, null if none found
     */
    public getStreamForFile(filePath: string): Stream | null {
        if (!filePath) return null;

        // Find streams that match this file path
        const matchingStreams = this.getStreams().filter(stream =>
            FileUtils.fileBelongsToStream(filePath, stream.folder)
        );

        // Return the first match, or null if none found
        return matchingStreams.length > 0 ? matchingStreams[0] : null;
    }

    /**
     * Get stream information for external use
     * @param streamId The stream ID
     * @returns StreamInfo object or null if not found
     */
    public getStreamInfo(streamId: string): StreamInfo | null {
        const stream = this.getStream(streamId);
        if (!stream) return null;

        return {
            id: stream.id,
            name: stream.name,
            folder: stream.folder,
            icon: stream.icon,
            isActive: stream.id === this.getActiveStream()?.id
        };
    }

    /**
     * Get plugin version information
     * @returns PluginVersion object
     */
    public getVersion(): PluginVersion {
        return {
            version: '1.0.0',
            minAppVersion: '0.15.0',
            name: 'Streams',
            id: 'streams'
        };
    }

    /**
     * Check if a stream exists
     * @param streamId The stream ID to check
     * @returns True if the stream exists
     */
    public hasStream(streamId: string): boolean {
        return this.getStream(streamId) !== null;
    }

    /**
     * Get the number of configured streams
     * @returns Number of streams
     */
    public getStreamCount(): number {
        return this.getStreams().length;
    }

    /**
     * Check if any streams are configured
     * @returns True if at least one stream exists
     */
    public hasStreams(): boolean {
        return this.getStreamCount() > 0;
    }

    /**
     * Update the stream bar to match an opened file
     * @param filePath The path of the file that was opened
     * @returns True if successful, false if stream not found or update failed
     */
    public async updateStreamBarFromFile(filePath: string): Promise<boolean> {
        try {
            // Detect stream from file path
            const stream = this.getStreamForFile(filePath);
            if (!stream) {
                this.log(`No stream found for file: ${filePath}`);
                return false;
            }

            // Extract date from file path
            const targetDate = DateUtils.extractDateFromFilePath(filePath);

            // Update stream context and settings
            await this.updateStreamContext(stream.id, targetDate);

            // Emit event to trigger UI refresh
            eventBus.emit(EVENTS.ACTIVE_STREAM_CHANGED, { streamId: stream.id }, 'api');

            this.log(`Updated stream bar to "${stream.name}" for file: ${filePath} with date: ${targetDate.toISOString()}`);
            return true;

        } catch (error) {
            this.error(`Failed to update stream bar for file ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Update the active stream and date context
     * @param streamId The stream ID to set as active
     * @param targetDate The date to set in the date state manager
     */
    private async updateStreamContext(streamId: string, targetDate: Date): Promise<void> {
        const plugin = this.getPlugin();

        // Set the stream context
        plugin.settings.activeStreamId = streamId;
        await plugin.saveSettings();

        // Update the date state manager to reflect the file's date
        const { DateStateManager } = await import('../../shared/date-state-manager');
        const dateStateManager = DateStateManager.getInstance();
        dateStateManager.setCurrentDate(targetDate);
    }

}
