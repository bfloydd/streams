/**
 * Minimal view interface for error fallback views
 * Used when view creation fails and we need a safe fallback
 */
export interface MinimalView {
    getViewType: () => string;
    getDisplayText: () => string;
    getState: () => Record<string, unknown>;
    setState: (state: Record<string, unknown>) => Promise<void>;
    onOpen: () => Promise<void>;
    onClose: () => Promise<void>;
}

/**
 * Create a minimal fallback view for error cases
 */
export function createMinimalView(viewType: string, displayText: string): MinimalView {
    return {
        getViewType: () => viewType,
        getDisplayText: () => displayText,
        getState: () => ({}),
        setState: () => Promise.resolve(),
        onOpen: () => Promise.resolve(),
        onClose: () => Promise.resolve()
    };
}


