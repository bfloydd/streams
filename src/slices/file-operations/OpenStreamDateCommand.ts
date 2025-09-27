import { App } from 'obsidian';
import { Stream } from '../../shared/types';
import { openStreamDate } from './streamUtils';
import { Logger } from '../debug-logging/Logger';
import { Command } from '../../shared/interfaces';

const log = new Logger();

export class OpenStreamDateCommand implements Command {
    constructor(
        private app: App,
        private stream: Stream,
        private date: Date,
        private reuseCurrentTab: boolean = false
    ) {}

    async execute(): Promise<void> {
        log.debug(`Opening ${this.date.toDateString()} for stream: ${this.stream.name}`);
        log.debug(`Reuse current tab: ${this.reuseCurrentTab}`);
        
        if (!(this.date instanceof Date) || isNaN(this.date.getTime())) {
            log.error(`Invalid date provided: ${this.date}`);
            return;
        }
        
        const formatted = this.formatDateForLogging(this.date);
        log.debug(`Formatted date for stream: ${formatted}`);
        
        await openStreamDate(this.app, this.stream, this.date, this.reuseCurrentTab);
    }
    
    /**
     * Format a date as YYYY-MM-DD for logging
     */
    private formatDateForLogging(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
} 