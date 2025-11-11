import { App } from 'obsidian';
import { Stream } from '../../shared/types';
import { OpenStreamDateCommand } from '../file-operations/OpenStreamDateCommand';
import { DateStateManager } from '../../shared/DateStateManager';

/**
 * Service for date formatting and navigation logic
 * Handles date formatting, navigation, and selection
 */
export class DateNavigationService {
    private app: App;
    private stream: Stream;
    private reuseCurrentTab: boolean;
    private dateStateManager: DateStateManager;

    constructor(app: App, stream: Stream, reuseCurrentTab: boolean) {
        this.app = app;
        this.stream = stream;
        this.reuseCurrentTab = reuseCurrentTab;
        this.dateStateManager = DateStateManager.getInstance();
    }

    /**
     * Update the stream reference
     * @param stream - The new stream to use for navigation
     */
    updateStream(stream: Stream): void {
        this.stream = stream;
    }

    /**
     * Format date as "Month Day" (e.g., "Jan 15")
     */
    formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    /**
     * Format date as YYYY-MM-DD string
     */
    formatDateString(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Format date as "Month Year" (e.g., "January 2024")
     */
    formatMonthYear(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    }

    /**
     * Check if a date is today
     */
    isToday(date: Date): boolean {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    }

    /**
     * Get number of days in a month
     */
    getDaysInMonth(year: number, month: number): number {
        return new Date(year, month, 0).getDate();
    }

    /**
     * Navigate to a different month
     * @param monthView - The current month view date (will be modified)
     * @param direction - -1 for previous month, 1 for next month
     * @returns The updated month view date
     */
    navigateMonth(monthView: Date, direction: number): Date {
        monthView.setMonth(monthView.getMonth() + direction);
        return monthView;
    }

    /**
     * Select a date and navigate to it
     * @param monthView - The current month view
     * @param day - The day of the month to select
     * @returns Promise that resolves when navigation is complete
     */
    async selectDate(monthView: Date, day: number): Promise<void> {
        const selectedDate = new Date(monthView.getFullYear(), monthView.getMonth(), day);
        
        // Update the date state
        this.dateStateManager.setCurrentDate(selectedDate);
        
        // Navigate to the selected date
        const command = new OpenStreamDateCommand(this.app, this.stream, selectedDate, this.reuseCurrentTab);
        await command.execute();
    }

    /**
     * Navigate to adjacent day
     * @param offset - -1 for previous day, 1 for next day
     */
    async navigateToAdjacentDay(offset: number): Promise<void> {
        // Update the date state first
        this.dateStateManager.navigateToAdjacentDay(offset);
        
        // Then navigate to the new date
        const state = this.dateStateManager.getState();
        const command = new OpenStreamDateCommand(this.app, this.stream, state.currentDate, this.reuseCurrentTab);
        await command.execute();
    }
}

