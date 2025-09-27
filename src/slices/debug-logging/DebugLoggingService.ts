import { Plugin } from 'obsidian';
import { PluginAwareSliceService, SettingsAwareSliceService } from '../../shared/base-slice';
import { Logger, LogLevel } from './Logger';
import { ToggleDebugLoggingCommand } from './ToggleDebugLoggingCommand';
import { Command } from '../../shared/interfaces';
import { centralizedLogger } from '../../shared/centralized-logger';

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
        
        // Initialize centralized logging based on settings
        const settings = this.getSettings();
        if (settings.debugLoggingEnabled) {
            centralizedLogger.enable(LogLevel.DEBUG);
        } else {
            centralizedLogger.enable(LogLevel.INFO);
        }

        this.initialized = true;
    }

    cleanup(): void {
        this.toggleCommand = null;
        this.initialized = false;
    }

    onSettingsChanged(settings: any): void {
        if (settings.debugLoggingEnabled) {
            centralizedLogger.enable(LogLevel.DEBUG);
        } else {
            centralizedLogger.enable(LogLevel.INFO);
        }
    }

    /**
     * Get the logger instance
     */
    getLogger(): Logger {
        return this.logger;
    }

    /**
     * Create toggle command for debug logging
     */
    createToggleCommand(): Command {
        if (!this.toggleCommand) {
            const plugin = this.getPlugin() as any;
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

    /**
     * Enable debug logging
     */
    enableDebug(): void {
        centralizedLogger.enable(LogLevel.DEBUG);
        const plugin = this.getPlugin() as any;
        if (plugin.settings) {
            plugin.settings.debugLoggingEnabled = true;
        }
    }

    /**
     * Disable debug logging
     */
    disableDebug(): void {
        centralizedLogger.enable(LogLevel.INFO);
        const plugin = this.getPlugin() as any;
        if (plugin.settings) {
            plugin.settings.debugLoggingEnabled = false;
        }
    }
}
