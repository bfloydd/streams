import { Stream } from '../../types';

/**
 * Public API interface for the Streams plugin
 * This allows other plugins to access stream data and functionality
 */
export interface StreamsAPI {
    /**
     * Get all available streams
     * @returns Array of all configured streams
     */
    getStreams(): Stream[];

    /**
     * Get a specific stream by ID
     * @param streamId The unique identifier of the stream
     * @returns The stream if found, null otherwise
     */
    getStream(streamId: string): Stream | null;

    /**
     * Get the currently active stream
     * @returns The active stream if set, null otherwise
     */
    getActiveStream(): Stream | null;

    /**
     * Get streams that match a specific folder path
     * @param folderPath The folder path to search for
     * @returns Array of streams that match the folder path
     */
    getStreamsByFolder(folderPath: string): Stream[];

    /**
     * Get the stream that contains a specific file
     * @param filePath The file path to check
     * @returns The stream that contains this file, null if none found
     */
    getStreamForFile(filePath: string): Stream | null;

    /**
     * Get basic stream information (name, path, icon) for external use
     * @returns Array of basic stream information
     */
    getStreamInfo(): StreamInfo[];

    /**
     * Check if a stream exists
     * @param streamId The stream ID to check
     * @returns True if the stream exists, false otherwise
     */
    hasStream(streamId: string): boolean;

    /**
     * Get the total number of configured streams
     * @returns Number of streams
     */
    getStreamCount(): number;

    /**
     * Get plugin version information
     * @returns Plugin version details
     */
    getVersion(): PluginVersion;
}

/**
 * Basic stream information for external consumption
 * Contains only the essential data needed by other plugins
 */
export interface StreamInfo {
    id: string;
    name: string;
    folder: string;
    icon: string;
    isActive: boolean;
}

/**
 * Plugin version information
 */
export interface PluginVersion {
    version: string;
    minAppVersion: string;
    name: string;
    id: string;
}
