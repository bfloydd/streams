import { Plugin } from 'obsidian';
import { SliceService, PluginAwareService, StreamAwareService, SettingsAwareService, StreamsPluginInterface, SettingsManager, StreamManager, UIController, ServiceContainer, LogProvider } from './interfaces';
import { Stream, StreamsSettings } from './types';
import { centralizedLogger } from './centralized-logger';

export abstract class BaseSliceService implements SliceService {
    protected initialized = false;

    abstract initialize(): Promise<void>;
    abstract cleanup(): void;

    protected log(message: string, ...args: any[]): void {
        centralizedLogger.info(`[${this.constructor.name}] ${message}`, ...args);
    }

    protected error(message: string, ...args: any[]): void {
        centralizedLogger.error(`[${this.constructor.name}] ${message}`, ...args);
    }
}

export abstract class PluginAwareSliceService extends BaseSliceService implements PluginAwareService {
    protected plugin: StreamsPluginInterface | null = null;

    setPlugin(plugin: Plugin): void {
        this.plugin = plugin as StreamsPluginInterface;
    }

    protected getPlugin(): StreamsPluginInterface {
        if (!this.plugin) {
            throw new Error('Plugin not set. Call setPlugin() first.');
        }
        return this.plugin;
    }

    // Focused interface accessors for ISP compliance
    protected getSettingsManager(): SettingsManager {
        return this.getPlugin() as SettingsManager;
    }

    protected getStreamManager(): StreamManager {
        return this.getPlugin() as StreamManager;
    }

    protected getUIController(): UIController {
        return this.getPlugin() as UIController;
    }

    protected getServiceContainer(): ServiceContainer {
        return this.getPlugin() as ServiceContainer;
    }

    protected getLogProvider(): LogProvider {
        return this.getPlugin() as LogProvider;
    }

    // Common accessor methods to eliminate duplication across services
    protected getStreams(): Stream[] {
        const settingsManager = this.getSettingsManager();
        return settingsManager.settings?.streams || [];
    }

    protected getSettings(): StreamsSettings {
        const settingsManager = this.getSettingsManager();
        return settingsManager.settings;
    }

    protected async saveSettings(): Promise<void> {
        const settingsManager = this.getSettingsManager();
        await settingsManager.saveSettings();
    }

    protected getActiveStream(): Stream | null {
        const settingsManager = this.getSettingsManager();
        const activeStreamId = settingsManager.settings?.activeStreamId;
        if (!activeStreamId) return null;
        return this.getStreams().find(s => s.id === activeStreamId) || null;
    }
}

export abstract class StreamAwareSliceService extends PluginAwareSliceService implements StreamAwareService {
    abstract onStreamAdded(stream: Stream): void;
    abstract onStreamUpdated(stream: Stream): void;
    abstract onStreamRemoved(streamId: string): void;
    abstract onActiveStreamChanged(streamId: string | undefined): void;
}

export abstract class SettingsAwareSliceService extends PluginAwareSliceService implements SettingsAwareService {
    abstract onSettingsChanged(settings: StreamsSettings): void;
}
