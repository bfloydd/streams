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
        
        // Validate we're using a proper date object
        if (!(this.date instanceof Date) || isNaN(this.date.getTime())) {
            log.error(`Invalid date provided: ${this.date}`);
            return;
        }
        
        // Format the date for debugging
        const year = this.date.getFullYear();
        const month = String(this.date.getMonth() + 1).padStart(2, '0');
        const day = String(this.date.getDate()).padStart(2, '0');
        const formatted = `${year}-${month}-${day}`;
        
        log.debug(`Formatted date for stream: ${formatted}`);
        
        await openStreamDate(this.app, this.stream, this.date);
    }
} 