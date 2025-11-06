import { Plugin } from 'obsidian';
import { PluginAwareSliceService, SettingsAwareSliceService } from '../../shared/base-slice';
import { Logger, LogLevel } from './Logger';
import { ToggleDebugLoggingCommand } from './ToggleDebugLoggingCommand';
import { Command } from '../../shared/interfaces';
import { centralizedLogger } from '../../shared/centralized-logger';
import { StreamsSettings } from '../../shared/types';

export class DebugLoggingService extends SettingsAwareSliceService {
    private logger: Logger;
    private toggleCommand: ToggleDebugLoggingCommand | null = null;

    constructor() {
        super();
        this.logger = new Logger('Streams');
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.logger = new Logger('Streams');
        
        const settings = this.getSettings();
        if (settings.debugLoggingEnabled) {
            centralizedLogger.enable(LogLevel.DEBUG);
        } else {
            centralizedLogger.disable();
        }

        this.initialized = true;
    }

    cleanup(): void {
        this.toggleCommand = null;
        this.initialized = false;
    }

    onSettingsChanged(settings: StreamsSettings): void {
        if (settings.debugLoggingEnabled) {
            centralizedLogger.enable(LogLevel.DEBUG);
        } else {
            centralizedLogger.disable();
        }
    }

    getLogger(): Logger {
        return this.logger;
    }

    createToggleCommand(): Command {
        if (!this.toggleCommand) {
            const plugin = this.getPlugin();
            this.toggleCommand = new ToggleDebugLoggingCommand(
                plugin.app,
                this.logger,
                (enabled: boolean) => {
                    plugin.settings.debugLoggingEnabled = enabled;
                },
                () => plugin.saveSettings()
            );
        }
        return this.toggleCommand;
    }

    enableDebug(): void {
        centralizedLogger.enable(LogLevel.DEBUG);
        const plugin = this.getPlugin();
        if (plugin.settings) {
            plugin.settings.debugLoggingEnabled = true;
        }
    }

    disableDebug(): void {
        centralizedLogger.enable(LogLevel.INFO);
        const plugin = this.getPlugin();
        if (plugin.settings) {
            plugin.settings.debugLoggingEnabled = false;
        }
    }
}
