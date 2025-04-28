import { App, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { Stream } from '../../types';
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
    private currentViewedDate: string | null = null;
    private todayButton: HTMLElement; // Add this property to store reference

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

        // Get current file's date if it exists
        const currentFile = markdownView.file;
        if (currentFile) {
            const match = currentFile.basename.match(/^\d{4}-\d{2}-\d{2}/);
            if (match) {
                this.currentViewedDate = match[0];
            }
        }

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
            this.updateTodayButton(); // Update button when files change
        }
    }

    private initializeWidget() {
        // Create collapsed view
        const collapsedView = this.widget.createDiv('stream-calendar-collapsed');
        collapsedView.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(collapsedView, expandedView);
        });

        // Add stream name above the date
        const streamLabel = collapsedView.createDiv('stream-calendar-label');
        streamLabel.setText(this.selectedStream.name);

        // Create navigation controls container
        const navControls = collapsedView.createDiv('stream-calendar-nav-controls');
        
        // Add previous day button (LEFT ARROW)
        const prevDayButton = navControls.createDiv('stream-calendar-day-nav prev-day');
        prevDayButton.setText('←');
        prevDayButton.setAttribute('aria-label', 'Previous Day');
        prevDayButton.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent toggle expansion
            this.log.debug("LEFT ARROW CLICKED - Going to PREVIOUS day");
            
            // Direct navigation to previous day using explicit manual date calculation
            if (this.currentViewedDate) {
                const [year, month, day] = this.currentViewedDate.split('-').map(n => parseInt(n, 10));
                
                // Create a date object for the current day
                const currentDate = new Date(year, month - 1, day);
                this.log.debug(`Current date before navigation: ${currentDate.toISOString()}`);
                
                // Create a new date object for the day before
                const previousDate = new Date(currentDate);
                previousDate.setDate(previousDate.getDate() - 1);
                this.log.debug(`Target previous date: ${previousDate.toISOString()}`);
                
                // Navigate to the previous day
                const command = new OpenStreamDateCommand(this.app, this.selectedStream, previousDate);
                await command.execute();
            } else {
                // If no current date, use yesterday
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                this.log.debug(`No current date, going to yesterday: ${yesterday.toISOString()}`);
                
                const command = new OpenStreamDateCommand(this.app, this.selectedStream, yesterday);
                await command.execute();
            }
        });
        
        // Add today button (between navigation buttons)
        const todayButton = navControls.createDiv('stream-calendar-today-button');
        this.todayButton = todayButton; // Store reference
        this.updateTodayButton(); // Use new method
        
        // Add next day button (RIGHT ARROW)
        const nextDayButton = navControls.createDiv('stream-calendar-day-nav next-day');
        nextDayButton.setText('→');
        nextDayButton.setAttribute('aria-label', 'Next Day');
        nextDayButton.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent toggle expansion
            this.log.debug("RIGHT ARROW CLICKED - Going to NEXT day");
            
            // Direct navigation to next day using explicit manual date calculation
            if (this.currentViewedDate) {
                const [year, month, day] = this.currentViewedDate.split('-').map(n => parseInt(n, 10));
                
                // Create a date object for the current day
                const currentDate = new Date(year, month - 1, day);
                this.log.debug(`Current date before navigation: ${currentDate.toISOString()}`);
                
                // Create a new date object for the next day
                const nextDate = new Date(currentDate);
                nextDate.setDate(nextDate.getDate() + 1);
                this.log.debug(`Target next date: ${nextDate.toISOString()}`);
                
                // Navigate to the next day
                const command = new OpenStreamDateCommand(this.app, this.selectedStream, nextDate);
                await command.execute();
            } else {
                // If no current date, use tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                this.log.debug(`No current date, going to tomorrow: ${tomorrow.toISOString()}`);
                
                const command = new OpenStreamDateCommand(this.app, this.selectedStream, tomorrow);
                await command.execute();
            }
        });

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

    private updateTodayButton() {
        this.log.debug(`Updating today button with currentViewedDate: ${this.currentViewedDate}`);
        
        if (!this.currentViewedDate) {
            const today = new Date();
            this.todayButton.setText(this.formatDate(today));
            this.log.debug(`No current viewed date, showing today: ${this.formatDate(today)}`);
            return;
        }

        const today = new Date();
        const todayFormatted = today.toISOString().split('T')[0];
        
        if (this.currentViewedDate === todayFormatted) {
            this.todayButton.setText('TODAY');
            this.log.debug(`Current date is today, showing "TODAY"`);
        } else {
            // Explicitly parse date components to avoid timezone issues
            const [year, month, day] = this.currentViewedDate.split('-').map(n => parseInt(n, 10));
            const viewedDate = new Date(year, month - 1, day); // month is 0-based in Date constructor
            
            const formattedDate = this.formatDate(viewedDate);
            this.todayButton.setText(formattedDate);
            this.log.debug(`Current date is not today, showing formatted date: ${formattedDate}`);
        }
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
            
            // Format date for comparison
            const currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dateString = currentDate.toISOString().split('T')[0];
            
            // Add viewed class if this is the current file's date
            if (dateString === this.currentViewedDate) {
                dayEl.addClass('viewed');
            }
            
            // Check content for this day
            const content = await this.getContentIndicator(currentDate);
            
            if (content.exists) {
                const dots = content.size === 'small' ? 1 : content.size === 'medium' ? 2 : 3;
                for (let i = 0; i < dots; i++) {
                    dotContainer.createDiv('content-dot');
                }
            }
            
            if (this.isToday(currentDate)) {
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

    private isToday(date: Date): boolean {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    }

    private async selectDate(day: number) {
        const selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
        // Update currentViewedDate before executing command
        this.currentViewedDate = selectedDate.toISOString().split('T')[0];
        const command = new OpenStreamDateCommand(this.app, this.selectedStream, selectedDate);
        await command.execute();
        this.updateTodayButton();
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.style.display = this.expanded ? 'block' : 'none';
        collapsedView.toggleClass('today-button-expanded', this.expanded);
        expandedView.toggleClass('calendar-expanded', this.expanded);
    }

    private loadStyles() {
        const additionalStyles = `
            .calendar-day {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                border: 1px solid transparent;
                padding: 4px;
                border-radius: 4px;
            }

            .calendar-day.viewed {
                border-color: var(--text-accent);
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

            .calendar-day.today {
                color: var(--text-accent);
                font-weight: 600;
            }

            .calendar-day.today .content-dot {
                background-color: var(--text-accent);
            }

            .stream-calendar-label {
                font-size: 0.8em;
                color: var(--text-muted);
                margin-bottom: 2px;
            }

            .stream-calendar-collapsed {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
        `;

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

    /**
     * Navigate to the previous or next day relative to the currently viewed date
     * @param offset Number of days to offset (negative for previous, positive for next)
     */
    private async navigateToAdjacentDay(offset: number): Promise<void> {
        this.log.debug(`==== NAVIGATION START ====`);
        this.log.debug(`Current viewed date: ${this.currentViewedDate}`);
        this.log.debug(`Offset: ${offset}`);
        
        // Create a new date from the current viewed date or today
        let baseDate: Date;
        
        if (this.currentViewedDate) {
            // Split into components and create new date to avoid timezone issues
            const [year, month, day] = this.currentViewedDate.split('-').map(n => parseInt(n, 10));
            baseDate = new Date(year, month - 1, day);
            this.log.debug(`Base date from current viewed: ${baseDate.toISOString()}`);
        } else {
            baseDate = new Date();
            // Set to start of day to avoid time issues
            baseDate.setHours(0, 0, 0, 0);
            this.log.debug(`Base date from today: ${baseDate.toISOString()}`);
        }
        
        // Clone the date to avoid mutation issues
        const targetDate = new Date(baseDate.getTime());
        
        // Add the offset days
        targetDate.setDate(targetDate.getDate() + offset);
        this.log.debug(`Target date after adding offset: ${targetDate.toISOString()}`);
        
        // Format date parts manually to avoid timezone issues
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth() + 1; // JS months are 0-indexed
        const targetDay = targetDate.getDate();
        
        // Format with proper zero-padding
        const formattedDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
        this.log.debug(`Formatted target date: ${formattedDate}`);
        
        // Update state
        this.currentViewedDate = formattedDate;
        this.currentDate = new Date(targetYear, targetMonth - 1, 1); // First day of month for calendar
        
        this.log.debug(`Updated current date for month view: ${this.currentDate.toISOString()}`);
        
        // Navigate to the new date
        this.log.debug(`Opening stream date: ${formattedDate}`);
        const command = new OpenStreamDateCommand(this.app, this.selectedStream, targetDate);
        await command.execute();
        
        // Update the UI
        this.updateTodayButton();
        
        if (this.expanded && this.grid) {
            this.updateCalendarGrid(this.grid);
        }
        
        this.log.debug(`==== NAVIGATION END ====`);
    }

    public setCurrentViewedDate(dateString: string): void {
        this.log.debug(`Setting currentViewedDate explicitly to: ${dateString}`);
        this.currentViewedDate = dateString;
        
        // Also update the month view to the correct month
        if (dateString) {
            const [year, month, day] = dateString.split('-').map(n => parseInt(n, 10));
            this.currentDate = new Date(year, month - 1, 1); // First day of month for calendar view
        }
        
        // Update the UI to reflect the new date
        this.updateTodayButton();
        
        if (this.grid) {
            this.updateCalendarGrid(this.grid);
        }
    }
} 