import { App, Notice } from 'obsidian';
import { Command } from '../../shared/interfaces';
import { Logger, LogLevel } from './Logger';

export class ToggleDebugLoggingCommand implements Command {
    constructor(
        private app: App,
        private logger: Logger,
        private updateSetting: (enabled: boolean) => void,
        private saveSettings: () => Promise<void>
    ) {}

    async execute(): Promise<void> {
        // Toggle between DEBUG and NONE
        if (this.logger.isEnabled()) {
            this.logger.off();
            this.updateSetting(false);
            new Notice('Streams logging disabled');
        } else {
            this.logger.on(LogLevel.DEBUG);
            this.updateSetting(true);
            new Notice('Streams logging enabled (DEBUG level)');
        }
        
        // Save settings
        await this.saveSettings();
    }
}
