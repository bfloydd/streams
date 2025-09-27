import { Plugin } from 'obsidian';
import { SliceService, PluginAwareService, StreamAwareService, SettingsAwareService } from './interfaces';
import { Stream, StreamsSettings } from './types';
import { centralizedLogger } from './centralized-logger';

/**
 * Base class for all slice services
 */
export abstract class BaseSliceService implements SliceService {
    protected plugin: Plugin | null = null;
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

/**
 * Base class for plugin-aware services
 */
export abstract class PluginAwareSliceService extends BaseSliceService implements PluginAwareService {
    setPlugin(plugin: Plugin): void {
        this.plugin = plugin;
    }

    protected getPlugin(): Plugin {
        if (!this.plugin) {
            throw new Error('Plugin not set. Call setPlugin() first.');
        }
        return this.plugin;
    }
}

/**
 * Base class for stream-aware services
 */
export abstract class StreamAwareSliceService extends PluginAwareSliceService implements StreamAwareService {
    abstract onStreamAdded(stream: Stream): void;
    abstract onStreamUpdated(stream: Stream): void;
    abstract onStreamRemoved(streamId: string): void;
    abstract onActiveStreamChanged(streamId: string | undefined): void;

    protected getStreams(): Stream[] {
        const plugin = this.getPlugin() as any;
        return plugin.settings?.streams || [];
    }

    protected getActiveStream(): Stream | undefined {
        const plugin = this.getPlugin() as any;
        const activeStreamId = plugin.settings?.activeStreamId;
        if (!activeStreamId) return undefined;
        return this.getStreams().find(s => s.id === activeStreamId);
    }
}

/**
 * Base class for settings-aware services
 */
export abstract class SettingsAwareSliceService extends PluginAwareSliceService implements SettingsAwareService {
    abstract onSettingsChanged(settings: StreamsSettings): void;

    protected getSettings(): StreamsSettings {
        const plugin = this.getPlugin() as any;
        return plugin.settings;
    }

    protected async saveSettings(): Promise<void> {
        const plugin = this.getPlugin() as any;
        if (plugin.saveSettings) {
            await plugin.saveSettings();
        }
    }
}
