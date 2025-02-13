import { App, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { Stream } from '../../types';
import { openStreamDate } from '../utils/streamUtils';
import { Logger } from '../utils/Logger';
import { OpenStreamDateCommand } from '../commands/OpenStreamDateCommand';
import { OpenTodayStreamCommand } from '../commands/OpenTodayStreamCommand';

interface ContentIndicator {
    exists: boolean;
    size: 'small' | 'medium' | 'large';
}

export class CalendarWidget {
    private widget: HTMLElement;
    private expanded: boolean = false;
    private currentDate: Date = new Date();
    private selectedStream: Stream;
    private app: App;
    private log: Logger = new Logger();
    private grid: HTMLElement | null = null;  // Store grid reference
    private fileModifyHandler: () => void;    // Store handler for cleanup

    constructor(leaf: WorkspaceLeaf, stream: Stream, app: App) {
        this.log.debug('Creating calendar widget for stream:', stream.name);
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
        
        // Add file modification listener
        this.fileModifyHandler = this.handleFileModify.bind(this);
        this.app.vault.on('modify', this.fileModifyHandler);

        this.initializeWidget();
        this.loadStyles();
    }

    private handleFileModify(file: TFile) {
        // Only update if the file is in our stream's folder
        const streamPath = this.selectedStream.folder.split(/[/\\]/).filter(Boolean);
        const filePath = file.path.split(/[/\\]/).filter(Boolean);
        
        const isInStream = streamPath.every((part, index) => streamPath[index] === filePath[index]);
        
        if (isInStream && this.grid) {
            this.updateCalendarGrid(this.grid);
        }
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
        this.grid = grid;  // Store reference
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
            const command = new OpenTodayStreamCommand(this.app, this.selectedStream);
            await command.execute();
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

    private async getContentIndicator(date: Date): Promise<ContentIndicator> {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const fileName = `${year}-${month}-${day}.md`;
        
        const folderPath = this.selectedStream.folder
            .split(/[/\\]/)
            .filter(Boolean)
            .join('/');
        
        const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
        const file = this.app.vault.getAbstractFileByPath(filePath);

        if (!(file instanceof TFile)) {
            return { exists: false, size: 'small' };
        }

        // Use file.stat.size instead of reading contents
        const fileSize = file.stat.size;

        let size: 'small' | 'medium' | 'large';
        // Adjust these thresholds based on typical markdown file sizes
        // Current thresholds: 1KB and 5KB
        if (fileSize < 1024) {
            size = 'small';
        } else if (fileSize < 5120) {
            size = 'medium';
        } else {
            size = 'large';
        }

        return { exists: true, size };
    }

    private async updateCalendarGrid(grid: HTMLElement) {
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
            const dateContainer = dayEl.createDiv('date-container');
            dateContainer.setText(String(day));
            
            const dotContainer = dayEl.createDiv('dot-container');
            
            // Check content for this day
            const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const content = await this.getContentIndicator(date);
            
            if (content.exists) {
                const dots = content.size === 'small' ? 1 : content.size === 'medium' ? 2 : 3;
                for (let i = 0; i < dots; i++) {
                    dotContainer.createDiv('content-dot');
                }
            }
            
            if (this.isToday(day)) {
                dayEl.addClass('today');
            }
            
            const handleDaySelect = (e: Event) => {
                e.preventDefault();
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
        const command = new OpenStreamDateCommand(this.app, this.selectedStream, selectedDate);
        await command.execute();
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.style.display = this.expanded ? 'block' : 'none';
        collapsedView.toggleClass('today-button-expanded', this.expanded);
        expandedView.toggleClass('calendar-expanded', this.expanded);
    }

    private loadStyles() {
        // Add these styles to the existing styles in main.ts
        const additionalStyles = `
            .calendar-day {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }

            .dot-container {
                display: flex;
                gap: 2px;
                height: 4px;
            }

            .content-dot {
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background-color: var(--text-muted);
            }

            .calendar-day:hover .content-dot {
                background-color: var(--text-normal);
            }

            .calendar-day.today .content-dot {
                background-color: var(--text-accent);
            }
        `;

        // Add styles to the document
        const styleEl = document.getElementById('streams-calendar-styles');
        if (styleEl) {
            styleEl.textContent += additionalStyles;
        }
    }

    public destroy() {
        this.log.debug('Destroying calendar widget');
        // Remove event listener
        this.app.vault.off('modify', this.fileModifyHandler);
        
        if (this.widget && this.widget.parentElement) {
            this.widget.remove();
        }
    }
} 