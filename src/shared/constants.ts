/**
 * Plugin constants
 */
export const PLUGIN_ID = 'streams';
export const PLUGIN_NAME = 'Streams';

/**
 * View types
 */
export const CREATE_FILE_VIEW_TYPE = 'streams-create-file-view';

/**
 * Default settings
 */
export const DEFAULT_SETTINGS = {
    streams: [],
    showCalendarComponent: true,
    reuseCurrentTab: false,
    activeStreamId: undefined,
    debugLoggingEnabled: false
} as const;

/**
 * CSS classes
 */
export const CSS_CLASSES = {
    CALENDAR_COMPONENT: 'streams-calendar-component',
    CALENDAR_GRID: 'streams-calendar-grid',
    CALENDAR_DAY: 'streams-calendar-day',
    CALENDAR_DAY_TODAY: 'streams-calendar-day-today',
    CALENDAR_DAY_SELECTED: 'streams-calendar-day-selected',
    CALENDAR_DAY_HAS_CONTENT: 'streams-calendar-day-has-content',
    STREAMS_PLUGIN_CONTAINER: 'streams-plugin-container',
    STREAMS_PLUGIN_CARD: 'streams-plugin-card',
    GLOBAL_STREAM_INDICATOR: 'streams-global-indicator'
} as const;

