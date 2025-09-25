import { App, WorkspaceLeaf, TFile, MarkdownView, View, Component, setIcon } from 'obsidian';
import { Stream } from '../../types';
import { Logger } from '../utils/Logger';
import { OpenStreamDateCommand } from '../commands/OpenStreamDateCommand';
import { OpenTodayStreamCommand } from '../commands/OpenTodayStreamCommand';
import { OpenTodayCurrentStreamCommand } from '../commands/OpenTodayCurrentStreamCommand';
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

interface PluginInterface {
    settings: {
        activeStreamId?: string;
    };
    saveSettings(): void;
    setActiveStream(streamId: string, force?: boolean): void;
}

export class CalendarComponent extends Component {
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
    private reuseCurrentTab: boolean;
    private streamsDropdown: HTMLElement | null = null;
    private streams: Stream[];
    private plugin: PluginInterface | null;
    
    /**
     * Get the stream name to display (active stream if available, otherwise selected stream)
     */
    private getDisplayStreamName(): string {
        if (this.plugin?.settings?.activeStreamId) {
            const activeStream = this.streams.find(s => s.id === this.plugin!.settings.activeStreamId);
            if (activeStream) {
                return activeStream.name;
            }
        }
        return this.selectedStream.name;
    }
    
    /**
     * Get the active stream ID (from plugin settings) or fall back to selected stream ID
     */
    private getActiveStreamId(): string {
        return this.plugin?.settings?.activeStreamId || this.selectedStream.id;
    }

    constructor(leaf: WorkspaceLeaf, stream: Stream, app: App, reuseCurrentTab: boolean = false, streams: Stream[] = [], plugin: PluginInterface | null = null) {
        super();
        
        // Remove any existing calendar components before creating new one
        const existingComponents = document.querySelectorAll('.streams-calendar-component');
        existingComponents.forEach(component => {
            component.remove();
        });
        
        this.selectedStream = stream;
        this.app = app;
        this.reuseCurrentTab = reuseCurrentTab;
        this.streams = streams;
        this.plugin = plugin;
        
        this.component = document.createElement('div');
        this.component.addClass('streams-calendar-component');
        
        
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
                    // Set the currentDate to match the viewed date so the calendar shows the correct month
                    const [year, month, day] = match[0].split('-').map(n => parseInt(n, 10));
                    this.currentDate = new Date(year, month - 1, day); // month is 0-indexed
                    this.log.debug(`Set currentDate to match viewed date: ${this.currentViewedDate} -> ${this.currentDate.toISOString()}`);
                }
            }
            
            // No need for fixed position class - the CSS handles positioning
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
            
            // No need for fixed position class - the CSS handles positioning
        } else {
            // Cast to unknown first, then to ViewWithContentEl to avoid TypeScript errors
            const view = leaf.view as unknown as ViewWithContentEl;
            contentContainer = view.contentEl;
            
            // No need for fixed position class - the CSS handles positioning
        }
        
        if (!contentContainer) {
            this.log.error('Could not find content container');
            return;
        }

        contentContainer.addClass('streams-markdown-view-content');
        
        contentContainer.appendChild(this.component);
        
        this.fileModifyHandler = this.handleFileModify.bind(this);
        this.registerEvent(this.app.vault.on('modify', this.fileModifyHandler));

        this.initializeComponent();
    }

    private handleFileModify(file: TFile) {
        const streamPath = this.selectedStream.folder.split(/[/\\]/).filter(Boolean);
        const filePath = file.path.split(/[/\\]/).filter(Boolean);
        
        const isInStream = streamPath.every((part, index) => streamPath[index] === filePath[index]);
        
        if (isInStream && this.grid) {
            this.updateGridContent(this.grid);
            this.updateTodayButton();
        }
    }

    private initializeComponent() {
        const collapsedView = this.component.createDiv('streams-calendar-collapsed');
        const expandedView = this.component.createDiv('streams-calendar-expanded');

        // Create the navigation controls
        const navControls = collapsedView.createDiv('streams-calendar-nav-controls');
        
        const prevDayButton = navControls.createDiv('streams-calendar-day-nav prev-day');
        prevDayButton.setText('←');
        prevDayButton.setAttribute('aria-label', 'Previous day');
        prevDayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.log.debug("LEFT ARROW CLICKED - Going to PREVIOUS day");
            await this.navigateToAdjacentDay(-1);
        });
        
        const todayButton = navControls.createDiv('streams-calendar-today-button');
        this.todayButton = todayButton;
        this.updateTodayButton();
        
        // Add click handler to TODAY button to open calendar
        todayButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(collapsedView, expandedView);
        });
        
        const nextDayButton = navControls.createDiv('streams-calendar-day-nav next-day');
        nextDayButton.setText('→');
        nextDayButton.setAttribute('aria-label', 'Next day');
        nextDayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.log.debug("RIGHT ARROW CLICKED - Going to NEXT day");
            await this.navigateToAdjacentDay(1);
        });
        
        const homeButton = navControls.createDiv('streams-calendar-home-button');
        setIcon(homeButton, 'home');
        homeButton.setAttribute('aria-label', 'Go to current stream today');
        homeButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.log.debug("HOME BUTTON CLICKED - Going to current stream today");
            const command = new OpenTodayCurrentStreamCommand(this.app, this.streams, this.reuseCurrentTab, this.plugin);
            await command.execute();
        });
        
        const settingsButton = navControls.createDiv('streams-calendar-settings-button');
        setIcon(settingsButton, 'settings');
        settingsButton.setAttribute('aria-label', 'Open Streams plugin settings');
        settingsButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.log.debug("SETTINGS BUTTON CLICKED - Opening Streams plugin settings");
            const setting = (this.app as any).setting;
            setting.open();
            setting.openTabById('streams');
        });
        

        // Create the "Change Stream" section
        const changeStreamSection = collapsedView.createDiv('streams-calendar-change-stream');
        const changeStreamText = changeStreamSection.createDiv('streams-calendar-change-stream-text');
        changeStreamText.setText(this.getDisplayStreamName());
        changeStreamSection.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStreamsDropdown();
        });

        // Create the streams dropdown
        this.streamsDropdown = changeStreamSection.createDiv('streams-calendar-streams-dropdown');
        this.streamsDropdown.style.display = 'none';
        this.populateStreamsDropdown();

        const topNav = expandedView.createDiv('streams-calendar-top-nav');
        const todayNavButton = topNav.createDiv('streams-calendar-today-nav');
        todayNavButton.setText('Today');
        const streamName = topNav.createDiv('streams-calendar-name');
        streamName.setText(this.getDisplayStreamName());

        const header = expandedView.createDiv('streams-calendar-header');
        const prevButton = header.createDiv('streams-calendar-nav');
        prevButton.setText('←');
        const dateDisplay = header.createDiv('streams-calendar-date');
        dateDisplay.setText(this.formatMonthYear(this.currentDate));
        const nextButton = header.createDiv('streams-calendar-nav');
        nextButton.setText('→');

        const grid = expandedView.createDiv('streams-calendar-grid');
        this.grid = grid;
        this.updateCalendarGrid(grid);

        // Set up event listeners
        prevButton.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            dateDisplay.setText(this.formatMonthYear(this.currentDate));
            if (grid.children.length > 0) {
                this.updateGridContent(grid);
            } else {
                this.updateCalendarGrid(grid);
            }
        });

        nextButton.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            dateDisplay.setText(this.formatMonthYear(this.currentDate));
            if (grid.children.length > 0) {
                this.updateGridContent(grid);
            } else {
                this.updateCalendarGrid(grid);
            }
        });


        todayNavButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            const command = new OpenTodayStreamCommand(this.app, this.selectedStream, this.reuseCurrentTab);
            await command.execute();
            this.currentDate = new Date();
            dateDisplay.setText(this.formatMonthYear(this.currentDate));
            if (grid.children.length > 0) {
                this.updateGridContent(grid);
            } else {
                this.updateCalendarGrid(grid);
            }
        });

        document.addEventListener('click', (e) => {
            if (this.expanded && !this.component.contains(e.target as Node)) {
                this.toggleExpanded(collapsedView, expandedView);
            }
            
            // Close streams dropdown when clicking outside
            if (this.streamsDropdown && this.streamsDropdown.style.display !== 'none' && !this.component.contains(e.target as Node)) {
                this.toggleStreamsDropdown();
            }
        });

        // Add keyboard event listener for Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.expanded) {
                e.preventDefault();
                e.stopPropagation();
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
        // Don't recreate the entire grid if it already exists and just needs content updates
        if (grid.children.length > 0) {
            // Just update the content indicators without recreating the entire grid
            await this.updateGridContent(grid);
            return;
        }
        
        grid.empty();
        
        const daysInMonth = this.getDaysInMonth(this.currentDate.getFullYear(), this.currentDate.getMonth());
        const firstDayOfMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1).getDay();
        
        // Add day headers (Su, Mo, Tu, etc.)
        for (let i = 0; i < 7; i++) {
            const dayHeader = grid.createDiv('streams-calendar-day-header');
            dayHeader.textContent = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][i];
        }
        
        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            grid.createDiv('streams-calendar-day empty');
        }
        
        // Add all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = grid.createDiv('streams-calendar-day');
            
            const dateContainer = dayEl.createDiv('streams-date-container');
            dateContainer.textContent = String(day);
            
            const dotContainer = dayEl.createDiv('streams-dot-container');
            
            const currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            // Use timezone-safe date string creation instead of toISOString()
            const dateString = this.formatDateString(currentDate);
            
            if (dateString === this.currentViewedDate) {
                dayEl.addClass('viewed');
            }
            
            const content = await this.getContentIndicator(currentDate);
            
            if (content.exists) {
                const dots = content.size === 'small' ? 1 : content.size === 'medium' ? 2 : 3;
                for (let i = 0; i < dots; i++) {
                    dotContainer.createDiv('streams-content-dot');
                }
            }
            
            if (this.isToday(currentDate)) {
                dayEl.addClass('today');
            }
            
            const handleDaySelect = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.log.debug(`Day ${day} clicked, handling selection`);
                this.selectDate(day);
            };

            dayEl.addEventListener('click', handleDaySelect);
            dayEl.addEventListener('touchend', handleDaySelect);
        }
    }
    
    private async updateGridContent(grid: HTMLElement) {
        // Update only the content indicators without recreating the grid
        const dayElements = grid.querySelectorAll('.streams-calendar-day:not(.empty)');
        
        for (let i = 0; i < dayElements.length; i++) {
            const dayEl = dayElements[i] as HTMLElement;
            const day = i + 1;
            
            // Clear existing content indicators
            const dotContainer = dayEl.querySelector('.streams-dot-container');
            if (dotContainer) {
                dotContainer.empty();
            }
            
            // Update viewed state
            const currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dateString = this.formatDateString(currentDate);
            
            dayEl.removeClass('viewed');
            if (dateString === this.currentViewedDate) {
                dayEl.addClass('viewed');
            }
            
            // Update today state
            dayEl.removeClass('today');
            if (this.isToday(currentDate)) {
                dayEl.addClass('today');
            }
            
            // Update content indicators
            const content = await this.getContentIndicator(currentDate);
            if (content.exists && dotContainer) {
                const dots = content.size === 'small' ? 1 : content.size === 'medium' ? 2 : 3;
                for (let j = 0; j < dots; j++) {
                    dotContainer.createDiv('streams-content-dot');
                }
            }
        }
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    private formatDateString(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private formatMonthYear(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    }

    private isToday(date: Date): boolean {
        const today = new Date();
        // Compare individual components to avoid timezone issues
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    }

    private async selectDate(day: number) {
        this.log.debug(`selectDate called for day: ${day}`);
        const selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
        this.currentViewedDate = this.formatDateString(selectedDate);
        
        const command = new OpenStreamDateCommand(this.app, this.selectedStream, selectedDate, this.reuseCurrentTab);
        await command.execute();
        this.updateTodayButton();
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.toggleClass('streams-calendar-expanded-active', this.expanded);
        collapsedView.toggleClass('streams-today-button-expanded', this.expanded);
        
        if (this.expanded) {
            const grid = this.grid;
            if (grid) {
                if (grid.children.length > 0) {
                    // Grid already exists, just update content
                    setTimeout(() => {
                        this.updateGridContent(grid);
                    }, 10);
                } else {
                    // Grid doesn't exist yet, create it
                    setTimeout(() => {
                        this.updateCalendarGrid(grid);
                    }, 10);
                }
            }
        }
    }

    private updateTodayButton() {
        this.log.debug(`Updating today button with currentViewedDate: ${this.currentViewedDate}`);
        
        if (!this.currentViewedDate) {
            const today = new Date();
            this.todayButton.setText(this.formatDate(today));
            this.log.debug(`No current viewed date, showing today: ${this.formatDate(today)}`);
            return;
        }

        // Use timezone-safe date comparison instead of toISOString()
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDay = today.getDate();
        
        // Parse the viewed date components
        const [viewedYear, viewedMonth, viewedDay] = this.currentViewedDate.split('-').map(n => parseInt(n, 10));
        
        if (viewedYear === todayYear && viewedMonth === todayMonth + 1 && viewedDay === todayDay) {
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


    public destroy() {
        this.log.debug('Destroying calendar component');
        
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
            
            const command = new OpenStreamDateCommand(this.app, this.selectedStream, targetDate, this.reuseCurrentTab);
            await command.execute();
        } else {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + offset);
            const direction = offset > 0 ? "tomorrow" : "yesterday";
            this.log.debug(`No current date, going to ${direction}: ${targetDate.toISOString()}`);
            
            const command = new OpenStreamDateCommand(this.app, this.selectedStream, targetDate, this.reuseCurrentTab);
            await command.execute();
        }
    }

    private toggleStreamsDropdown() {
        if (this.streamsDropdown) {
            const isVisible = this.streamsDropdown.style.display !== 'none';
            this.streamsDropdown.style.display = isVisible ? 'none' : 'block';
        }
    }

    private populateStreamsDropdown() {
        if (!this.streamsDropdown) return;
        
        this.streamsDropdown.empty();
        
        // Display streams in the same order as they appear in Obsidian Streams Settings
        // The streams array passed from main.ts (this.settings.streams) maintains the exact order
        // from the settings UI, so we iterate through them in that order
        this.streams.forEach(stream => {
            const streamItem = this.streamsDropdown!.createDiv('streams-calendar-stream-item');
            
            // Add a class to indicate if this is the currently selected stream
            // Use the active stream ID if available, otherwise use the selected stream
            const isSelected = stream.id === this.getActiveStreamId();
            if (isSelected) {
                streamItem.addClass('streams-calendar-stream-item-selected');
            }
            
            const streamIcon = streamItem.createDiv('streams-calendar-stream-item-icon');
            setIcon(streamIcon, stream.icon);
            const streamName = streamItem.createDiv('streams-calendar-stream-item-name');
            streamName.setText(stream.name);
            
            // Add a checkmark for the currently selected stream
            if (isSelected) {
                const checkmark = streamItem.createDiv('streams-calendar-stream-item-checkmark');
                setIcon(checkmark, 'check');
            }
            
            streamItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectStream(stream);
                this.toggleStreamsDropdown();
            });
        });
    }

    private selectStream(stream: Stream) {
        // Update the selected stream
        this.selectedStream = stream;
        
        // Update the change stream text to show the new stream name
        const changeStreamText = this.component.querySelector('.streams-calendar-change-stream-text');
        if (changeStreamText) {
            changeStreamText.setText(stream.name);
        }
        
        // Also update the stream name in the view
        const streamNameElement = this.component.querySelector('.streams-calendar-name');
        if (streamNameElement) {
            streamNameElement.setText(stream.name);
        }
        
        // Only update the calendar grid if it exists and needs content updates
        if (this.grid) {
            this.updateGridContent(this.grid);
        }
        
        // Close the dropdown
        if (this.streamsDropdown) {
            this.streamsDropdown.style.display = 'none';
        }
        
        // Set this as the active stream in the main plugin
        // This is a user-initiated action, so force the change
        if (this.plugin && this.plugin.setActiveStream) {
            this.plugin.setActiveStream(stream.id, true);
        }
        
        // Navigate to the selected stream's daily note
        this.navigateToStreamDailyNote(stream);
        
        // Refresh the dropdown to update visual indicators
        this.refreshStreamsDropdown();
    }

    private async navigateToStreamDailyNote(stream: Stream) {
        try {
            // Use the current viewed date if available, otherwise use today
            let targetDate: Date;
            if (this.currentViewedDate) {
                targetDate = this.parseViewedDate(this.currentViewedDate);
            } else {
                targetDate = new Date();
            }
            
            // Use the existing OpenStreamDateCommand which properly handles stream navigation
            const command = new OpenStreamDateCommand(this.app, stream, targetDate, this.reuseCurrentTab);
            await command.execute();
            
            // Update the current viewed date
            this.currentViewedDate = this.formatDateString(targetDate);
            this.updateTodayButton();
        } catch (error) {
            this.log.error('Error navigating to stream daily note:', error);
        }
    }

    public setCurrentViewedDate(dateString: string): void {
        this.log.debug(`Setting currentViewedDate explicitly to: ${dateString}`);
        this.currentViewedDate = dateString;
        
        if (dateString) {
            const [year, month, day] = dateString.split('-').map(n => parseInt(n, 10));
            this.currentDate = new Date(year, month - 1, day); // Use the exact day, not just the first of the month
        }
        
        this.updateTodayButton();
        
        if (this.grid) {
            if (this.grid.children.length > 0) {
                this.updateGridContent(this.grid);
            } else {
                this.updateCalendarGrid(this.grid);
            }
        }
    }

    public updateStreamsList(streams: Stream[]) {
        this.streams = streams;
        if (this.streamsDropdown) {
            this.populateStreamsDropdown();
        }
    }

    public refreshStreamsDropdown() {
        if (this.streamsDropdown) {
            this.populateStreamsDropdown();
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