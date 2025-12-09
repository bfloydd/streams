import { Stream } from '../../shared/types';
import { StreamProvider } from '../../shared/interfaces';
import { StreamDataService } from './StreamDataService';

/**
 * Service responsible for providing stream data access
 * Implements the StreamProvider interface with a single responsibility:
 * managing access to stream information through delegation to StreamDataService.
 *
 * This follows the Single Responsibility Principle by focusing solely on
 * stream data provision, separating it from orchestration and other concerns.
 */
export class StreamProviderService implements StreamProvider {
    /**
     * Creates a new StreamProviderService with injected StreamDataService dependency
     * @param streamDataService - The service that handles actual stream data operations
     */
    constructor(private streamDataService: StreamDataService) {}

    /**
     * Get all available streams
     * @returns Array of all configured streams
     */
    getStreams(): Stream[] {
        return this.streamDataService.getStreams();
    }

    /**
     * Get the default stream configuration
     * @returns The default stream with fallback values if service unavailable
     */
    getDefaultStream(): Stream {
        return this.streamDataService.getDefaultStream() || {
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
     * Get the currently active stream
     * @returns The active stream or undefined if none is active
     */
    getActiveStream(): Stream | undefined {
        return this.streamDataService.getActiveStream();
    }
}
