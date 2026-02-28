import { Plugin } from 'obsidian';

export type LucideIcon =
    // Files & Documents
    | 'file-text' | 'file' | 'files' | 'folder' | 'book' | 'notebook' | 'diary'
    // Communication & Social
    | 'message-circle' | 'message-square' | 'mail' | 'inbox' | 'send'
    // Time & Planning
    | 'alarm-check' | 'calendar' | 'clock' | 'timer' | 'history'
    // UI Elements
    | 'home' | 'settings' | 'search' | 'bookmark' | 'star' | 'heart' | 'layout-dashboard'
    // Content
    | 'text' | 'edit' | 'pencil' | 'pen' | 'list' | 'check-square'
    // Media
    | 'image' | 'video' | 'music' | 'camera'
    // Weather & Nature
    | 'sun' | 'moon' | 'cloud' | 'umbrella'
    // Misc
    | 'user' | 'users' | 'tag' | 'flag' | 'bookmark' | 'link';

export interface Stream {
    id: string;
    name: string;
    folder: string;
    icon: LucideIcon;
    showTodayInRibbon: boolean;
    addCommand: boolean;
    encryptThisStream: boolean; // New field for encryption toggle
    disabled: boolean; // New field for disabling streams
    dateFormat: string; // New field for flexible date formatting
}

export interface StreamsSettings {
    streams: Stream[];
    /**
     * The single "primary" stream used by "Go to primary stream".
     * Null means no primary stream is configured.
     */
    primaryStreamId: string | null;
    showStreamsBarComponent: boolean;
    reuseCurrentTab: boolean;

    debugLoggingEnabled: boolean; // Whether debug logging is enabled by default
    barStyle: 'default' | 'modern'; // Style variant for the streams bar
}

// Specific error data types for better type safety
export interface FunctionCallErrorData {
    args: unknown[];
    functionName?: string;
}

// Union type for error data - more specific than generic key-value pairs
// Additional specific error types can be added here as needed
export type ErrorData =
    | FunctionCallErrorData
    | Record<string, unknown>; // Fallback for custom error data

// Event Data Types for type-safe event payloads
export type EventData =
    // Stream events
    | { stream: Stream } // STREAM_ADDED, STREAM_UPDATED
    | { streamId: string } // STREAM_REMOVED

    | { streamId: string; disabled: boolean } // STREAM_UPDATED (disabled state)

    // Settings events
    | StreamsSettings // SETTINGS_CHANGED

    // UI events
    | { component: string } // CALENDAR_COMPONENT_UPDATED, RIBBON_ICONS_UPDATED

    // File events
    | { filePath: string } // FILE_OPENED, FILE_CREATED

    // Plugin events
    | { plugin: Plugin } // PLUGIN_LOADED, PLUGIN_UNLOADED

    // Error events
    | { error: Error; service: string; method: string; data?: ErrorData } // ERROR_OCCURRED

    // Date events
    | { date: Date; monthView?: Date } // date-changed

    // View events
    | any; // Fallback for custom view events (kept for extensibility)


// Log Types for type-safe logging
export type LogMessage = string | number | boolean | null | undefined;
export type LogParams = (LogMessage | object | Error)[];
