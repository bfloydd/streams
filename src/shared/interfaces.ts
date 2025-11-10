import { App, Plugin, WorkspaceLeaf } from 'obsidian';
import { Stream, StreamsSettings } from './types';
import { SliceContainer } from './SliceContainer';
import { Logger } from '../slices/debug-logging';
import { FileOperationsService } from '../slices/file-operations';

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
 * Interface for stream data access
 */
export interface StreamProvider {
    getStreams(): Stream[];
    getDefaultStream(): Stream;
}

/**
 * Interface for file path generation
 */
export interface FilePathProvider {
    getDefaultFilePath(stream: Stream): string;
}

/**
 * Interface for view registration
 */
export interface ViewRegistrar {
    registerView(viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any): void;
}

/**
 * Interface for calendar view type checking
 */
export interface CalendarViewChecker {
    shouldCreateCalendarForViewType(viewType: string): boolean;
}

/**
 * Interface for leaf inspection
 */
export interface LeafInspector {
    isMainEditorLeaf(leaf: WorkspaceLeaf): boolean;
}

/**
 * Interface for settings management
 */
export interface SettingsManager {
    settings: StreamsSettings;
    saveSettings(): Promise<void>;
}

/**
 * Interface for stream management operations
 */
export interface StreamManager {
    setActiveStream(streamId: string, force?: boolean): Promise<void>;
    getActiveStream(): Stream | undefined;
}

/**
 * Interface for UI component control
 */
export interface UIController {
    refreshAllStreamsBarComponents(): void;
    updateAllStreamsBarComponents(): void;
}

/**
 * Interface for service container access
 */
export interface ServiceContainer {
    sliceContainer?: SliceContainer;
    getFileOperationsService(): FileOperationsService | undefined;
}

/**
 * Interface for logging access
 */
export interface LogProvider {
    log: Logger | undefined;
}

/**
 * Main plugin interface that slices can depend on
 * Now composed of focused interfaces following ISP
 */
export interface StreamsPluginInterface extends
    Plugin,
    SettingsManager,
    StreamManager,
    UIController,
    ServiceContainer,
    LogProvider {
    app: App;
}
