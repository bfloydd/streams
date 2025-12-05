import { App, Notice, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../shared/types';
import { openStreamDate } from './streamUtils';
import { Logger } from '../debug-logging/Logger';
import { Command, StreamManager } from '../../shared/interfaces';
import { DateStateManager } from '../../shared/DateStateManager';

const log = new Logger();

export class OpenTodayCurrentStreamCommand implements Command {
    constructor(
        private app: App,
        private streams: Stream[],
        private reuseCurrentTab: boolean = false,
        private plugin?: StreamManager,
        private targetStream?: Stream,
        private targetLeaf?: WorkspaceLeaf,
        private dateStateManager?: DateStateManager
    ) { }

    async execute(): Promise<void> {
        log.debug('Executing OpenTodayCurrentStreamCommand');

        // Check if there are any streams configured
        if (this.streams.length === 0) {
            log.debug('No streams configured');
            new Notice('No streams configured. Please add streams in the plugin settings first.');
            return;
        }

        // Get the current stream from the targetStream or centralized active stream tracking
        const currentStream = this.targetStream || this.findCurrentStream();

        if (!currentStream) {
            log.debug('No current stream found, cannot open today note');
            new Notice('No active stream found. Please open a stream view or file to establish stream context.');
            return;
        }

        log.debug(`Opening today's note for current stream: ${currentStream.name}`);
        await openStreamDate(this.app, currentStream, new Date(), this.reuseCurrentTab, this.targetLeaf, this.dateStateManager);
    }

    private findCurrentStream(): Stream | null {
        // Get the active stream from the main plugin's centralized tracking
        if (this.plugin) {
            const activeStream = this.plugin.getActiveStream();
            if (activeStream) {
                log.debug(`Found active stream from plugin: ${activeStream.name}`);
                return activeStream;
            }
        }

        log.debug('No active stream found in plugin settings');
        return null;
    }
}
