import { App } from 'obsidian';
import { Stream } from '../../shared/types';
import { openStreamDate } from './streamUtils';
import { Logger } from '../debug-logging/Logger';
import { Command } from '../../shared/interfaces';


const log = new Logger();

export class OpenTodayStreamCommand implements Command {
    constructor(
        private app: App,
        private stream: Stream,
        private reuseCurrentTab: boolean = false
    ) {}

    async execute(): Promise<void> {
        log.debug(`Opening today's note for stream: ${this.stream.name}`);
        log.debug(`Reuse current tab: ${this.reuseCurrentTab}`);
        await openStreamDate(this.app, this.stream, new Date(), this.reuseCurrentTab);
    }
} 