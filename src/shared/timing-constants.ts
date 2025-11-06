/**
 * Timing constants for delays and intervals
 * Centralizes magic numbers for better maintainability
 */

/**
 * Delay constants in milliseconds
 */
export const TIMING = {
    /**
     * Short delay for DOM updates (e.g., after component creation)
     * Used for calendar grid updates after expansion
     */
    SHORT_DELAY: 10,
    
    /**
     * Standard delay for async operations
     * Used for file operations, view updates, and component initialization
     */
    STANDARD_DELAY: 100,
    
    /**
     * Delay for component initialization
     * Used when initializing calendar components for existing views
     */
    INITIALIZATION_DELAY: 100,
    
    /**
     * Delay for file operations
     * Used when waiting for file system operations to complete
     */
    FILE_OPERATION_DELAY: 100,
} as const;

