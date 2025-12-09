import { TFile } from 'obsidian';
import { Stream } from './types';

export class StreamContextService {
    /**
     * Determines which stream a file belongs to based on its path.
     * @param file The file to check.
     * @param streams The list of available streams.
     * @returns The matching Stream or null if not found.
     */
    public getStreamForFile(file: TFile | null, streams: Stream[]): Stream | null {
        if (!file || !streams || streams.length === 0) {
            return null;
        }

        // iterate through streams to find a match
        // A file belongs to a stream if its path starts with the stream's folder path
        for (const stream of streams) {
            if (this.isFileInStream(file, stream)) {
                return stream;
            }
        }

        return null;
    }

    /**
     * Checks if a specific file belongs to a specific stream.
     * @param file The file to check.
     * @param stream The stream to check against.
     */
    public isFileInStream(file: TFile, stream: Stream): boolean {
        if (!file.path || !stream.folder) return false;

        // Normalize paths for comparison (remove trailing slashes if any, though obsidian paths usually don't have them)
        const streamFolder = stream.folder.replace(/\/$/, '');

        // Exact match (file is the folder? unlikely) or subdirectory match
        // We verify it starts with "folder/"
        return file.path.startsWith(streamFolder + '/');
    }
}
