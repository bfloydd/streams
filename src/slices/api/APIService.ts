import { PluginAwareSliceService } from '../../shared/BaseSlice';
import { Stream } from '../../shared/types';
import { StreamsAPI, StreamInfo, PluginVersion } from './StreamsAPI';
import { eventBus, EVENTS } from '../../shared/EventBus';
import { DateUtils } from '../../shared/utils/DateUtils';
import { FileUtils } from '../../shared/utils/FileUtils';
import { getStreamBaseFolder } from '../file-operations/streamUtils';

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
            const streamFolder = FileUtils.normalizePath(getStreamBaseFolder(stream));
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
        const matchingStreams = this.getStreams().filter(stream => {
            return FileUtils.fileBelongsToStream(filePath, getStreamBaseFolder(stream));
        });

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
            folder: getStreamBaseFolder(stream),
            icon: stream.icon,
            isActive: false // Global active stream concept removed
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



}
