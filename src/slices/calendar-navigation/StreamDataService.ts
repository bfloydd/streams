import { Stream } from '../../shared/types';
import { StreamProvider, FilePathProvider } from '../../shared/interfaces';

/**
 * Provides stream data and file path business logic
 * Extracted from CalendarNavigationService to follow Single Responsibility Principle
 * Implements StreamProvider and FilePathProvider interfaces
 */
export class StreamDataService implements StreamProvider, FilePathProvider {
    private getSettingsManager: () => any;

    constructor(getSettingsManager: () => any) {
        this.getSettingsManager = getSettingsManager;
    }

    /**
     * Get all available streams
     */
    getStreams(): Stream[] {
        const settingsManager = this.getSettingsManager();
        return settingsManager.settings?.streams || [];
    }

    /**
     * Get the default stream (first available or fallback)
     */
    getDefaultStream(): Stream {
        const streams = this.getStreams();

        if (streams.length > 0) {
            return streams[0];
        }

        // Return a default stream if none exist
        return {
            id: 'default',
            name: 'Default Stream',
            icon: 'book',
            folder: 'Streams',
            showTodayInRibbon: true,
            addCommand: true,
            encryptThisStream: false,
            disabled: false
        };
    }

    /**
     * Get the default file path for a stream
     */
    getDefaultFilePath(stream: Stream): string {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const fileName = `${year}-${month}-${day}.md`;

        return `${stream.folder}/${fileName}`;
    }

    /**
     * Get the currently active stream
     */
    getActiveStream(): Stream | undefined {
        const settingsManager = this.getSettingsManager();
        const activeStreamId = settingsManager.settings?.activeStreamId;
        if (!activeStreamId) return undefined;
        const streams = this.getStreams();
        return streams.find(s => s.id === activeStreamId);
    }

    /**
     * Get stream to use (active stream or default)
     */
    getStreamToUse(): Stream | undefined {
        let streamToUse = this.getActiveStream();
        if (!streamToUse) {
            // If no active stream, try to get the first available stream
            const streams = this.getStreams();
            if (streams && streams.length > 0) {
                streamToUse = streams[0];
            }
        }
        return streamToUse;
    }

    /**
     * Check if a stream exists by ID
     */
    hasStream(streamId: string): boolean {
        const streams = this.getStreams();
        return streams.some(s => s.id === streamId);
    }

    /**
     * Get stream by ID
     */
    getStreamById(streamId: string): Stream | undefined {
        const streams = this.getStreams();
        return streams.find(s => s.id === streamId);
    }

    /**
     * Get enabled streams only
     */
    getEnabledStreams(): Stream[] {
        return this.getStreams().filter(stream => !stream.disabled);
    }
}