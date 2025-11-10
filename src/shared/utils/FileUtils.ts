/**
 * Utility functions for file path processing and analysis
 */
export class FileUtils {
    /**
     * Normalize a path for comparison
     * @param path The path to normalize
     * @returns Normalized path
     */
    static normalizePath(path: string): string {
        if (!path) return '';

        return path
            .split(/[/\\]/)
            .filter(Boolean)
            .join('/')
            .toLowerCase();
    }

    /**
     * Extract filename from a file path
     * @param filePath The file path
     * @returns The filename
     */
    static getFileName(filePath: string): string {
        return filePath.split('/').pop() || '';
    }

    /**
     * Check if a file path matches a stream folder
     * @param filePath The file path to check
     * @param streamFolder The stream folder path
     * @returns True if the file belongs to the stream
     */
    static fileBelongsToStream(filePath: string, streamFolder: string): boolean {
        const normalizedFilePath = this.normalizePath(filePath);
        const normalizedStreamFolder = this.normalizePath(streamFolder);

        return normalizedFilePath.startsWith(normalizedStreamFolder + '/') ||
               (normalizedStreamFolder === '' && !normalizedFilePath.includes('/'));
    }

    /**
     * Get the relative path within a stream folder
     * @param filePath The full file path
     * @param streamFolder The stream folder
     * @returns The relative path within the stream
     */
    static getRelativePath(filePath: string, streamFolder: string): string {
        const normalizedFilePath = this.normalizePath(filePath);
        const normalizedStreamFolder = this.normalizePath(streamFolder);

        if (normalizedStreamFolder === '') {
            return normalizedFilePath;
        }

        if (normalizedFilePath.startsWith(normalizedStreamFolder + '/')) {
            return normalizedFilePath.substring(normalizedStreamFolder.length + 1);
        }

        return normalizedFilePath;
    }
}