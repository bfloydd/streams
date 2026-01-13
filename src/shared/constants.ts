/**
 * View types
 */
export const CREATE_FILE_VIEW_TYPE = 'streams-create-file-view';

/**
 * View types that should have calendar components
 */
export const CALENDAR_ENABLED_VIEW_TYPES = [
    'empty',
    'file-explorer',
    'search',
    'graph',
    'markdown',
    'streams-install-meld-view',
    'streams-create-file-view-encrypted'
] as const;

/**
 * Default settings
 */
export const DEFAULT_SETTINGS = {
    streams: [],
    primaryStreamId: null,
    showStreamsBarComponent: true,
    reuseCurrentTab: false,
    debugLoggingEnabled: false,
    barStyle: 'default' as const
} as const;


