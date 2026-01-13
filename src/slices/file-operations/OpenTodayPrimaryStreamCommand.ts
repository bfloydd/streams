import { App, Notice, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../shared/types';
import { openStreamDate } from './streamUtils';
import { Logger } from '../debug-logging/Logger';
import { Command, SettingsManager } from '../../shared/interfaces';
import { DateStateManager } from '../../shared/DateStateManager';

const log = new Logger();

/**
 * Opens today's note for the single configured "primary" stream.
 *
 * The primary stream is selected in settings (stored as settings.primaryStreamId).
 */
export class OpenTodayPrimaryStreamCommand implements Command {
    constructor(
        private app: App,
        private streams: Stream[],
        private settingsManager: SettingsManager,
        private reuseCurrentTab: boolean = false,
        private targetLeaf?: WorkspaceLeaf,
        private dateStateManager?: DateStateManager
    ) { }

    async execute(): Promise<void> {
        log.debug('Executing OpenTodayPrimaryStreamCommand');

        if (this.streams.length === 0) {
            new Notice('No streams configured. Please add streams in the plugin settings first.');
            return;
        }

        const primaryStreamId = this.settingsManager.settings.primaryStreamId;
        if (!primaryStreamId) {
            new Notice('No primary stream is set. Select one in the Streams plugin settings.');
            return;
        }

        const primaryStream = this.streams.find(s => s.id === primaryStreamId) ?? null;
        if (!primaryStream) {
            // Settings references a stream that no longer exists.
            this.settingsManager.settings.primaryStreamId = null;
            await this.settingsManager.saveSettings();
            new Notice('Primary stream is missing. Please select a primary stream in settings.');
            return;
        }

        if (primaryStream.disabled) {
            new Notice(`Primary stream "${primaryStream.name}" is disabled. Enable it or choose a different primary stream.`);
            return;
        }

        log.debug(`Opening today's note for primary stream: ${primaryStream.name}`);
        await openStreamDate(
            this.app,
            primaryStream,
            new Date(),
            this.reuseCurrentTab,
            this.targetLeaf,
            this.dateStateManager
        );
    }
}

