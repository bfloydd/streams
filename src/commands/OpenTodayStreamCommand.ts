import { App } from 'obsidian';
import { Stream } from '../../types';
import { openStreamDate } from '../utils/streamUtils';
import { Logger } from '../utils/Logger';
import { Command } from './Command';


const log = new Logger();

export class OpenTodayStreamCommand implements Command {
    constructor(
        private app: App,
        private stream: Stream
    ) {}

    async execute(): Promise<void> {
        log.debug(`Opening today's note for stream: ${this.stream.name}`);
        await openStreamDate(this.app, this.stream);
    }
} 