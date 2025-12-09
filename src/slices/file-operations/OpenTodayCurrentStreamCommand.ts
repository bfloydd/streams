import { App, Notice, WorkspaceLeaf, MarkdownView } from 'obsidian';
import { Stream } from '../../shared/types';
import { openStreamDate } from './streamUtils';
import { Logger } from '../debug-logging/Logger';
import { Command, StreamManager } from '../../shared/interfaces';
import { DateStateManager } from '../../shared/DateStateManager';
import { StreamContextService } from '../../shared/StreamContextService';

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

        // Get the current stream from the targetStream or dynamic resolution
        const currentStream = this.targetStream || this.findCurrentStream();

        if (!currentStream) {
            log.debug('No current stream found, cannot open today note');
            new Notice('No active stream context found. Please open a file belonging to a stream first.');
            return;
        }

        log.debug(`Opening today's note for current stream: ${currentStream.name}`);
        await openStreamDate(this.app, currentStream, new Date(), this.reuseCurrentTab, this.targetLeaf, this.dateStateManager);
    }

    private findCurrentStream(): Stream | null {
        const streamContextService = new StreamContextService();

        // 1. Try target leaf if provided
        if (this.targetLeaf && this.targetLeaf.view instanceof MarkdownView && this.targetLeaf.view.file) {
            const stream = streamContextService.getStreamForFile(this.targetLeaf.view.file, this.streams);
            if (stream) return stream;
        }

        // 2. Try active file
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            const stream = streamContextService.getStreamForFile(activeFile, this.streams);
            if (stream) return stream;
        }

        log.debug('No stream context found for current context');
        return null;
    }
}
