import { App, Notice } from 'obsidian';
import { Stream } from '../../types';
import { openStreamDate } from '../utils/streamUtils';
import { Logger } from '../utils/Logger';
import { Command } from './Command';

const log = new Logger();

export class OpenCurrentStreamTodayCommand implements Command {
    constructor(
        private app: App,
        private streams: Stream[],
        private reuseCurrentTab: boolean = false,
        private plugin?: any // The main plugin instance to access active stream
    ) {}
    
    // Interface for the plugin instance
    private getPluginInterface() {
        return this.plugin as {
            getActiveStream(): Stream | null;
        };
    }

    async execute(): Promise<void> {
        log.debug('Executing OpenCurrentStreamTodayCommand');
        
        // Check if there are any streams configured
        if (this.streams.length === 0) {
            log.debug('No streams configured');
            new Notice('No streams configured. Please add streams in the plugin settings first.');
            return;
        }
        
        // Get the current stream from the centralized active stream tracking
        const currentStream = this.findCurrentStream();
        
        if (!currentStream) {
            log.debug('No current stream found, cannot open today note');
            new Notice('No active stream found. Please open a stream view or file to establish stream context.');
            return;
        }
        
        log.debug(`Opening today's note for current stream: ${currentStream.name}`);
        await openStreamDate(this.app, currentStream, new Date(), this.reuseCurrentTab);
    }
    
    private findCurrentStream(): Stream | null {
        // Get the active stream from the main plugin's centralized tracking
        const pluginInterface = this.getPluginInterface();
        if (pluginInterface && pluginInterface.getActiveStream) {
            const activeStream = pluginInterface.getActiveStream();
            if (activeStream) {
                log.debug(`Found active stream from plugin: ${activeStream.name}`);
                return activeStream;
            }
        }
        
        log.debug('No active stream found in plugin settings');
        return null;
    }
}
