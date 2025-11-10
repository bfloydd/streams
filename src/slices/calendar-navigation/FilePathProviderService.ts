import { Stream } from '../../shared/types';
import { FilePathProvider } from '../../shared/interfaces';
import { StreamDataService } from './StreamDataService';

/**
 * Service responsible for providing file path generation and resolution
 * Implements the FilePathProvider interface with a single responsibility:
 * managing file path logic through delegation to StreamDataService.
 *
 * This follows the Single Responsibility Principle by focusing solely on
 * file path provision, separating it from orchestration and other concerns.
 */
export class FilePathProviderService implements FilePathProvider {
    /**
     * Creates a new FilePathProviderService with injected StreamDataService dependency
     * @param streamDataService - The service that handles actual stream data operations
     */
    constructor(private streamDataService: StreamDataService) {}

    /**
     * Get the default file path for a given stream
     * @param stream - The stream configuration
     * @returns The default file path with fallback if service unavailable
     */
    getDefaultFilePath(stream: Stream): string {
        return this.streamDataService.getDefaultFilePath(stream) || `${stream.folder}/default.md`;
    }
}