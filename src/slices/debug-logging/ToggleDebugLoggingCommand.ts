import { App, Notice } from 'obsidian';
import { Command } from '../../shared/interfaces';
import { Logger, LogLevel } from './Logger';
import { centralizedLogger } from '../../shared/centralized-logger';

export class ToggleDebugLoggingCommand implements Command {
    constructor(
        private app: App,
        private logger: Logger,
        private updateSetting: (enabled: boolean) => void,
        private saveSettings: () => Promise<void>
    ) {}

    async execute(): Promise<void> {
        // Toggle between DEBUG and INFO
        if (centralizedLogger.isEnabled()) {
            centralizedLogger.enable(LogLevel.INFO);
            this.updateSetting(false);
            new Notice('Streams logging set to INFO level');
        } else {
            centralizedLogger.enable(LogLevel.DEBUG);
            this.updateSetting(true);
            new Notice('Streams logging enabled (DEBUG level)');
        }
        
        // Save settings
        await this.saveSettings();
    }
}
