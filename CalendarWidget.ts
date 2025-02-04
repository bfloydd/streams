import { App, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { Stream } from './types';
import { openStreamDate } from './streamUtils';

export class CalendarWidget {
    private widget: HTMLElement;
    private expanded: boolean = false;
    private currentDate: Date = new Date();
    private selectedStream: Stream;
    private app: App;

    constructor(leaf: WorkspaceLeaf, stream: Stream, app: App) {
        console.log('Creating calendar widget for stream:', stream.name);
        this.selectedStream = stream;
        this.app = app;
        
        this.widget = document.createElement('div');
        this.widget.addClass('stream-calendar-widget');
        
        // Find the markdown view container
        const markdownView = leaf.view as MarkdownView;
        const contentContainer = markdownView.contentEl;
        
        if (!contentContainer) {
            console.error('Could not find content container');
            return;
        }

        // Make the content container relative for absolute positioning
        contentContainer.style.position = 'relative';
        
        // Append to the content container
        contentContainer.appendChild(this.widget);
        
        this.initializeWidget();
    }

    private initializeWidget() {
        // Create collapsed view
        const collapsedView = this.widget.createDiv('stream-calendar-collapsed');
        collapsedView.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(collapsedView, expandedView);
        });

        const todayButton = collapsedView.createDiv('stream-calendar-today-button');
        todayButton.setText(this.formatDate(new Date()));

        // Create expanded view
        const expandedView = this.widget.createDiv('stream-calendar-expanded');
        expandedView.style.display = 'none';

        // Create top navigation bar with reversed positions
        const topNav = expandedView.createDiv('stream-calendar-top-nav');
        const todayNavButton = topNav.createDiv('stream-calendar-today-nav');
        todayNavButton.setText('TODAY');
        const streamName = topNav.createDiv('stream-calendar-name');
        streamName.setText(this.selectedStream.name);
        const backButton = topNav.createDiv('stream-calendar-back');
        backButton.setText('→');

        // Create calendar header
        const header = expandedView.createDiv('stream-calendar-header');
        const prevButton = header.createDiv('stream-calendar-nav');
        prevButton.setText('←');
        const dateDisplay = header.createDiv('stream-calendar-date');
        dateDisplay.setText(this.formatMonthYear(this.currentDate));
        const nextButton = header.createDiv('stream-calendar-nav');
        nextButton.setText('→');

        // Create calendar grid
        const grid = expandedView.createDiv('stream-calendar-grid');
        this.updateCalendarGrid(grid);

        // Event listeners
        prevButton.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            dateDisplay.setText(this.formatMonthYear(this.currentDate));
            this.updateCalendarGrid(grid);
        });

        nextButton.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            dateDisplay.setText(this.formatMonthYear(this.currentDate));
            this.updateCalendarGrid(grid);
        });

        backButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(collapsedView, expandedView);
        });

        todayNavButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.selectDate(new Date().getDate());
            this.currentDate = new Date();
            dateDisplay.setText(this.formatMonthYear(this.currentDate));
            this.updateCalendarGrid(grid);
        });

        document.addEventListener('click', (e) => {
            if (this.expanded && !this.widget.contains(e.target as Node)) {
                this.toggleExpanded(collapsedView, expandedView);
            }
        });
    }

    private updateCalendarGrid(grid: HTMLElement) {
        grid.empty();

        // Add day headers
        const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        days.forEach(day => {
            const dayHeader = grid.createDiv('calendar-day-header');
            dayHeader.setText(day);
        });

        // Get first day of month and total days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const totalDays = lastDay.getDate();
        const startingDay = firstDay.getDay();

        // Add blank spaces for days before start of month
        for (let i = 0; i < startingDay; i++) {
            grid.createDiv('calendar-day empty');
        }

        // Add days of month
        for (let day = 1; day <= totalDays; day++) {
            const dayEl = grid.createDiv('calendar-day');
            dayEl.setText(String(day));
            
            if (this.isToday(day)) {
                dayEl.addClass('today');
            }
            
            // Add both click and touch handlers
            const handleDaySelect = (e: Event) => {
                e.preventDefault(); // Prevent default touch behavior
                e.stopPropagation();
                this.selectDate(day);
            };

            dayEl.addEventListener('click', handleDaySelect);
            dayEl.addEventListener('touchend', handleDaySelect);
        }
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    private formatMonthYear(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    }

    private isToday(day: number): boolean {
        const today = new Date();
        return day === today.getDate() && 
               this.currentDate.getMonth() === today.getMonth() && 
               this.currentDate.getFullYear() === today.getFullYear();
    }

    private async selectDate(day: number) {
        const selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
        await openStreamDate(this.app, this.selectedStream, selectedDate);
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.style.display = this.expanded ? 'block' : 'none';
        collapsedView.toggleClass('today-button-expanded', this.expanded);
        expandedView.toggleClass('calendar-expanded', this.expanded);
    }

    public destroy() {
        console.log('Destroying calendar widget');
        if (this.widget && this.widget.parentElement) {
            this.widget.remove();
        }
    }
} 