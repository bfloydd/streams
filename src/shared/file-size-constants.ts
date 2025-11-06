/**
 * File size constants for content indicator thresholds
 * Centralizes magic numbers for better maintainability
 */

/**
 * File size thresholds in bytes for content indicators
 */
export const FILE_SIZE = {
    /**
     * Small file threshold (1 KB)
     * Files smaller than this are considered 'small'
     */
    SMALL_THRESHOLD: 1024,
    
    /**
     * Medium file threshold (5 KB)
     * Files between SMALL_THRESHOLD and this are considered 'medium'
     * Files larger than this are considered 'large'
     */
    MEDIUM_THRESHOLD: 5120,
} as const;

/**
 * Content indicator size categories
 */
export type ContentIndicatorSize = 'small' | 'medium' | 'large';

/**
 * Determine content indicator size based on file size
 * @param fileSize - File size in bytes
 * @returns Content indicator size category
 */
export function getContentIndicatorSize(fileSize: number): ContentIndicatorSize {
    if (fileSize < FILE_SIZE.SMALL_THRESHOLD) {
        return 'small';
    } else if (fileSize < FILE_SIZE.MEDIUM_THRESHOLD) {
        return 'medium';
    } else {
        return 'large';
    }
}

