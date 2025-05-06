import { App, WorkspaceLeaf, TFile, MarkdownView, View } from 'obsidian';
import { Stream } from '../../types';
import { Logger } from '../utils/Logger';
import { OpenStreamDateCommand } from '../commands/OpenStreamDateCommand';
import { OpenTodayStreamCommand } from '../commands/OpenTodayStreamCommand';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from '../views/CreateFileView';

interface ContentIndicator {
    exists: boolean;
    size: 'small' | 'medium' | 'large';
}

/**
 * Extended View interface that includes contentEl property
 * This is used for views that aren't fully typed in the obsidian API
 * but we know they have a contentEl property
 */
interface ViewWithContentEl extends View {
    contentEl: HTMLElement;
}

export class CalendarComponent {
    private component: HTMLElement;
    private expanded: boolean = false;
    private currentDate: Date = new Date();
    private selectedStream: Stream;
    private app: App;
    private log: Logger = new Logger();
    private grid: HTMLElement | null = null;
    private fileModifyHandler: () => void;
    private currentViewedDate: string | null = null;
    private todayButton: HTMLElement;

    constructor(leaf: WorkspaceLeaf, stream: Stream, app: App) {
        this.log.debug('Creating calendar component for stream:', stream.name);
        this.selectedStream = stream;
        this.app = app;
        
        this.component = document.createElement('div');
        this.component.addClass('stream-calendar-component');
        
        let contentContainer: HTMLElement | null = null;
        const viewType = leaf.view.getViewType();
        this.log.debug(`Creating calendar component for view type: ${viewType}`);
        
        if (viewType === 'markdown') {
            const markdownView = leaf.view as MarkdownView;
            contentContainer = markdownView.contentEl;
            
            const currentFile = markdownView.file;
            if (currentFile) {
                const match = currentFile.basename.match(/^\d{4}-\d{2}-\d{2}/);
                if (match) {
                    this.currentViewedDate = match[0];
                }
            }
        } else if (viewType === CREATE_FILE_VIEW_TYPE) {
            // Cast to unknown first, then to ViewWithContentEl to avoid TypeScript errors
            const view = leaf.view as unknown as ViewWithContentEl;
            contentContainer = view.contentEl;
            
            try {
                const state = leaf.view.getState();
                if (state && state.date) {
                    const dateString = state.date as string;
                    this.currentViewedDate = dateString.split('T')[0];
                    this.log.debug(`Set currentViewedDate from state: ${this.currentViewedDate}`);
                }
            } catch (error) {
                this.log.error('Error getting date from CreateFileView state:', error);
            }
        } else {
            // Cast to unknown first, then to ViewWithContentEl to avoid TypeScript errors
            const view = leaf.view as unknown as ViewWithContentEl;
            contentContainer = view.contentEl;
        }
        
        if (!contentContainer) {
            this.log.error('Could not find content container');
            return;
        }

        contentContainer.addClass('markdown-view-content');
        
        this.component.addClass('stream-calendar-component-fixed');
        
        contentContainer.appendChild(this.component);
        
        this.fileModifyHandler = this.handleFileModify.bind(this);
        this.app.vault.on('modify', this.fileModifyHandler);

        this.initializeComponent();
    }

    private handleFileModify(file: TFile) {
        const streamPath = this.selectedStream.folder.split(/[/\\]/).filter(Boolean);
        const filePath = file.path.split(/[/\\]/).filter(Boolean);
        
        const isInStream = streamPath.every((part, index) => streamPath[index] === filePath[index]);
        
        if (isInStream && this.grid) {
            this.updateCalendarGrid(this.grid);
            this.updateTodayButton();
        }
    }

    private initializeComponent() {
        const collapsedView = this.component.createDiv('stream-calendar-collapsed');
        collapsedView.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(collapsedView, expandedView);
        });

        const streamLabel = collapsedView.createDiv('stream-calendar-label');
        streamLabel.setText(this.selectedStream.name);

        const navControls = collapsedView.createDiv('stream-calendar-nav-controls');
        
        const prevDayButton = navControls.createDiv('stream-calendar-day-nav prev-day');
        prevDayButton.setText('←');
        prevDayButton.setAttribute('aria-label', 'Previous Day');
        prevDayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.log.debug("LEFT ARROW CLICKED - Going to PREVIOUS day");
            await this.navigateToAdjacentDay(-1);
        });
        
        const todayButton = navControls.createDiv('stream-calendar-today-button');
        this.todayButton = todayButton;
        this.updateTodayButton();
        
        const nextDayButton = navControls.createDiv('stream-calendar-day-nav next-day');
        nextDayButton.setText('→');
        nextDayButton.setAttribute('aria-label', 'Next Day');
        nextDayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.log.debug("RIGHT ARROW CLICKED - Going to NEXT day");
            await this.navigateToAdjacentDay(1);
        });

        const expandedView = this.component.createDiv('stream-calendar-expanded');

        const topNav = expandedView.createDiv('stream-calendar-top-nav');
        const todayNavButton = topNav.createDiv('stream-calendar-today-nav');
        todayNavButton.setText('TODAY');
        const streamName = topNav.createDiv('stream-calendar-name');
        streamName.setText(this.selectedStream.name);
        const backButton = topNav.createDiv('stream-calendar-back');
        backButton.setText('→');

        const header = expandedView.createDiv('stream-calendar-header');
        const prevButton = header.createDiv('stream-calendar-nav');
        prevButton.setText('←');
        const dateDisplay = header.createDiv('stream-calendar-date');
        dateDisplay.setText(this.formatMonthYear(this.currentDate));
        const nextButton = header.createDiv('stream-calendar-nav');
        nextButton.setText('→');

        const grid = expandedView.createDiv('stream-calendar-grid');
        this.grid = grid;
        this.updateCalendarGrid(grid);

        // Set up event listeners
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
            if (this.expanded && !this.component.contains(e.target as Node)) {
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
            const viewedDate = this.parseViewedDate(this.currentViewedDate);
            
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

        const fileSize = file.stat.size;

        let size: 'small' | 'medium' | 'large';
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
        
        const daysInMonth = this.getDaysInMonth(this.currentDate.getFullYear(), this.currentDate.getMonth());
        const firstDayOfMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1).getDay();
        
        // Add day headers (Su, Mo, Tu, etc.)
        for (let i = 0; i < 7; i++) {
            const dayHeader = grid.createDiv('stream-calendar-day-header');
            dayHeader.textContent = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][i];
        }
        
        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            grid.createDiv('calendar-day empty');
        }
        
        // Add all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = grid.createDiv('calendar-day');
            
            const dateContainer = dayEl.createDiv('date-container');
            dateContainer.textContent = String(day);
            
            const dotContainer = dayEl.createDiv('dot-container');
            
            const currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dateString = currentDate.toISOString().split('T')[0];
            
            if (dateString === this.currentViewedDate) {
                dayEl.addClass('viewed');
            }
            
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
        this.currentViewedDate = selectedDate.toISOString().split('T')[0];
        const command = new OpenStreamDateCommand(this.app, this.selectedStream, selectedDate);
        await command.execute();
        this.updateTodayButton();
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.toggleClass('calendar-expanded', this.expanded);
        collapsedView.toggleClass('today-button-expanded', this.expanded);
        
        if (this.expanded) {
            const grid = this.grid;
            if (grid) {
                setTimeout(() => {
                    this.updateCalendarGrid(grid);
                }, 10);
            }
        }
    }

    public destroy() {
        this.log.debug('Destroying calendar component');
        this.app.vault.off('modify', this.fileModifyHandler);
        
        if (this.component && this.component.parentElement) {
            this.component.remove();
        }
    }

    /**
     * Navigate to a day that is offset by a given number of days
     */
    private async navigateToAdjacentDay(offset: number): Promise<void> {
        if (this.currentViewedDate) {
            const currentDate = this.parseViewedDate(this.currentViewedDate);
            this.log.debug(`Current date before navigation: ${currentDate.toISOString()}`);
            
            const targetDate = new Date(currentDate);
            targetDate.setDate(targetDate.getDate() + offset);
            this.log.debug(`Target date: ${targetDate.toISOString()}`);
            
            const command = new OpenStreamDateCommand(this.app, this.selectedStream, targetDate);
            await command.execute();
        } else {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + offset);
            const direction = offset > 0 ? "tomorrow" : "yesterday";
            this.log.debug(`No current date, going to ${direction}: ${targetDate.toISOString()}`);
            
            const command = new OpenStreamDateCommand(this.app, this.selectedStream, targetDate);
            await command.execute();
        }
    }

    public setCurrentViewedDate(dateString: string): void {
        this.log.debug(`Setting currentViewedDate explicitly to: ${dateString}`);
        this.currentViewedDate = dateString;
        
        if (dateString) {
            const [year, month, day] = dateString.split('-').map(n => parseInt(n, 10));
            this.currentDate = new Date(year, month - 1, 1);
        }
        
        this.updateTodayButton();
        
        if (this.grid) {
            this.updateCalendarGrid(this.grid);
        }
    }

    /**
     * Parse a YYYY-MM-DD date string into a Date object
     */
    private parseViewedDate(dateString: string): Date {
        const [year, month, day] = dateString.split('-').map(n => parseInt(n, 10));
        return new Date(year, month - 1, day);
    }

    private getDaysInMonth(year: number, month: number): number {
        return new Date(year, month, 0).getDate();
    }
} 