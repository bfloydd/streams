import { App, Plugin } from 'obsidian';
import { Stream, StreamsSettings } from './types';

/**
 * Base interface for all slice services
 */
export interface SliceService {
    initialize(): Promise<void>;
    cleanup(): void;
}

/**
 * Interface for services that need access to the plugin instance
 */
export interface PluginAwareService extends SliceService {
    setPlugin(plugin: Plugin): void;
}

/**
 * Interface for services that manage streams
 */
export interface StreamAwareService {
    onStreamAdded(stream: Stream): void;
    onStreamUpdated(stream: Stream): void;
    onStreamRemoved(streamId: string): void;
    onActiveStreamChanged(streamId: string | undefined): void;
}

/**
 * Interface for services that need settings access
 */
export interface SettingsAwareService {
    onSettingsChanged(settings: StreamsSettings): void;
}

/**
 * Base command interface
 */
export interface Command {
    execute(): Promise<void>;
}

/**
 * Interface for command registration
 */
export interface CommandService {
    registerCommands(): void;
    unregisterCommands(): void;
}

/**
 * Interface for view management
 */
export interface ViewService {
    registerViews(): void;
    unregisterViews(): void;
}


/**
 * Main plugin interface that slices can depend on
 */
export interface StreamsPluginInterface extends Plugin {
    settings: StreamsSettings;
    app: App;
    log: any; // Logger type will be defined in debug-logging slice
    
    // Core methods that slices need
    saveSettings(): Promise<void>;
    refreshAllStreamsBarComponents(): void;
    updateAllStreamsBarComponents(): void;
    setActiveStream(streamId: string, force?: boolean): void;
    getActiveStream(): Stream | undefined;
    getFileOperationsService(): any;
}
