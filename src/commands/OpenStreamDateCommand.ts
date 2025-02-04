import { App } from 'obsidian';
import { Stream } from '../../types';
import { openStreamDate } from '../utils/streamUtils';
import { Logger } from '../utils/Logger';
import { Command } from './Command';


const log = new Logger();

export class OpenStreamDateCommand implements Command {
    constructor(
        private app: App,
        private stream: Stream,
        private date: Date
    ) {}

    async execute(): Promise<void> {
        log.debug(`Opening ${this.date.toDateString()} for stream: ${this.stream.name}`);
        await openStreamDate(this.app, this.stream, this.date);
    }
} 