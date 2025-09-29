import { App, WorkspaceLeaf, TFile, MarkdownView, View, Component, setIcon } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { OpenStreamDateCommand } from '../file-operations/OpenStreamDateCommand';
import { OpenTodayStreamCommand } from '../file-operations/OpenTodayStreamCommand';
import { OpenTodayCurrentStreamCommand } from '../file-operations/OpenTodayCurrentStreamCommand';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from '../file-operations/CreateFileView';
import { DateStateManager } from '../../shared/date-state-manager';

interface ContentIndicator {
    exists: boolean;
    size: 'small' | 'medium' | 'large';
}

// Extended View interface for views with contentEl property
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
    public leaf: WorkspaceLeaf;
    private selectedStream: Stream;
    private app: App;
    private grid: HTMLElement | null = null;
    private fileModifyHandler: () => void;
    private todayButton: HTMLElement;
    private reuseCurrentTab: boolean;
    private streamsDropdown: HTMLElement | null = null;
    private streams: Stream[];
    private plugin: PluginInterface | null;
    private dateStateManager: DateStateManager;
    private unsubscribeDateChanged: (() => void) | null = null;
    
    private getDisplayStreamName(): string {
        if (this.plugin?.settings?.activeStreamId) {
            const activeStream = this.streams.find(s => s.id === this.plugin!.settings.activeStreamId);
            if (activeStream) {
                return activeStream.name;
            }
        }
        return this.selectedStream.name;
    }
    
    private getActiveStreamId(): string {
        return this.plugin?.settings?.activeStreamId || this.selectedStream.id;
    }

    constructor(leaf: WorkspaceLeaf, stream: Stream, app: App, reuseCurrentTab: boolean = false, streams: Stream[] = [], plugin: PluginInterface | null = null) {
        super();
        
        this.leaf = leaf;

        this.selectedStream = stream;
        this.app = app;
        this.reuseCurrentTab = reuseCurrentTab;
        this.streams = streams;
        this.plugin = plugin;
        this.dateStateManager = DateStateManager.getInstance();
        
        this.component = document.createElement('div');
        this.component.addClass('streams-calendar-component');
        
        // Initialize date state based on current view
        this.initializeDateState(leaf);
        
        // Set up date change listener
        this.unsubscribeDateChanged = this.dateStateManager.onDateChanged((state) => {
            this.handleDateStateChange(state);
        });
        
        let contentContainer: HTMLElement | null = null;
        const viewType = leaf.view.getViewType();
        
        if (viewType === 'markdown') {
            const markdownView = leaf.view as MarkdownView;
            contentContainer = markdownView.contentEl;
            
        } else if (viewType === CREATE_FILE_VIEW_TYPE) {
            const view = leaf.view as unknown as ViewWithContentEl;
            if (!view) {
                centralizedLogger.error('CreateFileView is null');
                return;
            }
            contentContainer = view.contentEl;
            
        } else if (viewType === 'empty') {
            // For empty views, try to find the view-content element
            const viewContent = leaf.view.containerEl.querySelector('.view-content');
            if (viewContent) {
                contentContainer = viewContent as HTMLElement;

            } else {
                centralizedLogger.error('Could not find view-content for empty view');
                return;
            }
        } else if (viewType === 'file-explorer') {
            // For file explorer, add to the main content area
            const mainContent = leaf.view.containerEl.querySelector('.nav-files-container') || 
                               leaf.view.containerEl.querySelector('.nav-files') ||
                               leaf.view.containerEl;
            contentContainer = mainContent as HTMLElement;

        } else {
            const view = leaf.view as unknown as ViewWithContentEl;
            if (!view) {
                centralizedLogger.error('View is null');
                return;
            }
            contentContainer = view.contentEl;
        }
        
        if (!contentContainer) {
            centralizedLogger.error('Could not find content container');
            return;
        }

        // Remove existing calendar components from the same leaf to avoid duplicates
        const existingComponents = contentContainer.querySelectorAll('.streams-calendar-component');
        existingComponents.forEach(component => {
            component.remove();
        });
        
        // Also remove from document body to prevent duplicates
        const workspaceComponents = document.querySelectorAll('.streams-calendar-component');
        workspaceComponents.forEach((component: Element) => {
            component.remove();
        });

        contentContainer.addClass('streams-markdown-view-content');
        
        // Find the correct view-header (there might be multiple, we want the active one)
        const viewHeaders = document.querySelectorAll('.view-header');
        const viewHeader = viewHeaders[viewHeaders.length - 1]; // Get the last one (most likely the active one)
        
        if (viewHeader) {
            
            this.component.style.position = 'relative';
            this.component.style.display = 'block';
            this.component.style.width = '100%';
            this.component.style.margin = '0 0 10px 0';
            this.component.style.backgroundColor = 'var(--background-primary)';
            this.component.style.border = '1px solid var(--background-modifier-border)';
            this.component.style.borderRadius = '6px';
            this.component.style.padding = '8px';
            this.component.style.fontSize = '14px';
            this.component.style.lineHeight = '1.4';
            
            // Insert after the view-header instead of inside it
            if (viewHeader.parentElement) {
                viewHeader.parentElement.insertBefore(this.component, viewHeader.nextSibling);
            } else {
                viewHeader.appendChild(this.component);
            }
        } else {
            
            this.component.style.position = 'fixed';
            this.component.style.top = '60px';
            this.component.style.right = '20px';
            this.component.style.zIndex = '1000';
            this.component.style.backgroundColor = 'var(--background-primary)';
            this.component.style.border = '1px solid var(--background-modifier-border)';
            this.component.style.borderRadius = '6px';
            this.component.style.padding = '8px';
            this.component.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            
            document.body.appendChild(this.component);
        }
        
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

        const navControls = collapsedView.createDiv('streams-calendar-nav-controls');
        
        const prevDayButton = navControls.createDiv('streams-calendar-day-nav prev-day');
        prevDayButton.setText('←');
        prevDayButton.setAttribute('aria-label', 'Previous day');
        prevDayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.navigateToAdjacentDay(-1);
        });
        
        const todayButton = navControls.createDiv('streams-calendar-today-button');
        this.todayButton = todayButton;
        this.updateTodayButton();
        
        todayButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(collapsedView, expandedView);
        });
        
        const nextDayButton = navControls.createDiv('streams-calendar-day-nav next-day');
        nextDayButton.setText('→');
        nextDayButton.setAttribute('aria-label', 'Next day');
        nextDayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.navigateToAdjacentDay(1);
        });
        
        const homeButton = navControls.createDiv('streams-calendar-home-button');
        setIcon(homeButton, 'home');
        homeButton.setAttribute('aria-label', 'Go to current stream today');
        homeButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            const command = new OpenTodayCurrentStreamCommand(this.app, this.streams, this.reuseCurrentTab, this.plugin);
            await command.execute();
        });
        
        const settingsButton = navControls.createDiv('streams-calendar-settings-button');
        setIcon(settingsButton, 'settings');
        settingsButton.setAttribute('aria-label', 'Open Streams plugin settings');
        settingsButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            const setting = (this.app as any).setting;
            setting.open();
            setting.openTabById('streams');
        });

        const changeStreamSection = collapsedView.createDiv('streams-calendar-change-stream');
        const changeStreamText = changeStreamSection.createDiv('streams-calendar-change-stream-text');
        changeStreamText.setText(this.getDisplayStreamName());
        changeStreamSection.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStreamsDropdown();
        });

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
        const state = this.dateStateManager.getState();
        dateDisplay.setText(this.formatMonthYear(state.currentDate));
        const nextButton = header.createDiv('streams-calendar-nav');
        nextButton.setText('→');

        const grid = expandedView.createDiv('streams-calendar-grid');
        this.grid = grid;
        this.updateCalendarGrid(grid);

        prevButton.addEventListener('click', () => {
            const state = this.dateStateManager.getState();
            const newDate = new Date(state.currentDate);
            newDate.setMonth(newDate.getMonth() - 1);
            this.dateStateManager.setCurrentDate(newDate);
            dateDisplay.setText(this.formatMonthYear(newDate));
            if (grid.children.length > 0) {
                this.updateGridContent(grid);
            } else {
                this.updateCalendarGrid(grid);
            }
        });

        nextButton.addEventListener('click', () => {
            const state = this.dateStateManager.getState();
            const newDate = new Date(state.currentDate);
            newDate.setMonth(newDate.getMonth() + 1);
            this.dateStateManager.setCurrentDate(newDate);
            dateDisplay.setText(this.formatMonthYear(newDate));
            if (grid.children.length > 0) {
                this.updateGridContent(grid);
            } else {
                this.updateCalendarGrid(grid);
            }
        });

        todayNavButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            this.dateStateManager.navigateToToday();
            const command = new OpenTodayStreamCommand(this.app, this.selectedStream, this.reuseCurrentTab);
            await command.execute();
            const state = this.dateStateManager.getState();
            dateDisplay.setText(this.formatMonthYear(state.currentDate));
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
            
            if (this.streamsDropdown && this.streamsDropdown.style.display !== 'none' && !this.component.contains(e.target as Node)) {
                this.toggleStreamsDropdown();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.expanded) {
                e.preventDefault();
                e.stopPropagation();
                this.toggleExpanded(collapsedView, expandedView);
            }
        });

        // Force a re-render by triggering a layout recalculation
        this.component.offsetHeight; // Force layout

        // Also try to make sure the component is visible
        this.component.style.display = 'block';
        this.component.style.visibility = 'visible';
        this.component.style.opacity = '1';

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
        if (grid.children.length > 0) {
            await this.updateGridContent(grid);
            return;
        }
        
        grid.empty();
        
        const state = this.dateStateManager.getState();
        const currentDate = state.currentDate;
        const daysInMonth = this.getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
        
        for (let i = 0; i < 7; i++) {
            const dayHeader = grid.createDiv('streams-calendar-day-header');
            dayHeader.textContent = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][i];
        }
        
        for (let i = 0; i < firstDayOfMonth; i++) {
            grid.createDiv('streams-calendar-day empty');
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = grid.createDiv('streams-calendar-day');
            
            const dateContainer = dayEl.createDiv('streams-date-container');
            dateContainer.textContent = String(day);
            
            const dotContainer = dayEl.createDiv('streams-dot-container');
            
            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateString = this.formatDateString(dayDate);
            
            if (dateString === state.currentViewedDate) {
                dayEl.addClass('viewed');
            }
            
            const content = await this.getContentIndicator(dayDate);
            
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
                this.selectDate(day);
            };

            dayEl.addEventListener('click', handleDaySelect);
            dayEl.addEventListener('touchend', handleDaySelect);
        }
    }
    
    private async updateGridContent(grid: HTMLElement) {
        const dayElements = grid.querySelectorAll('.streams-calendar-day:not(.empty)');
        const state = this.dateStateManager.getState();
        const currentDate = state.currentDate;
        
        for (let i = 0; i < dayElements.length; i++) {
            const dayEl = dayElements[i] as HTMLElement;
            const day = i + 1;
            
            const dotContainer = dayEl.querySelector('.streams-dot-container');
            if (dotContainer) {
                dotContainer.empty();
            }
            
            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateString = this.formatDateString(dayDate);
            
            dayEl.removeClass('viewed');
            if (dateString === state.currentViewedDate) {
                dayEl.addClass('viewed');
            }
            
            dayEl.removeClass('today');
            if (this.isToday(dayDate)) {
                dayEl.addClass('today');
            }
            
            const content = await this.getContentIndicator(dayDate);
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
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    }

    private async selectDate(day: number) {
        const state = this.dateStateManager.getState();
        const selectedDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), day);
        
        // Update the date state
        this.dateStateManager.setCurrentDate(selectedDate);
        
        // Navigate to the selected date
        const command = new OpenStreamDateCommand(this.app, this.selectedStream, selectedDate, this.reuseCurrentTab);
        await command.execute();
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.toggleClass('streams-calendar-expanded-active', this.expanded);
        collapsedView.toggleClass('streams-today-button-expanded', this.expanded);
        
        if (this.expanded) {
            const grid = this.grid;
            if (grid) {
                if (grid.children.length > 0) {
                    setTimeout(() => {
                        this.updateGridContent(grid);
                    }, 10);
                } else {
                    setTimeout(() => {
                        this.updateCalendarGrid(grid);
                    }, 10);
                }
            }
        }
    }

    private updateTodayButton() {
        const state = this.dateStateManager.getState();
        const currentDate = state.currentDate;
        
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDay = today.getDate();
        
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const currentDay = currentDate.getDate();
        
        if (currentYear === todayYear && currentMonth === todayMonth && currentDay === todayDay) {
            this.todayButton.setText('TODAY');
        } else {
            const formattedDate = this.formatDate(currentDate);
            this.todayButton.setText(formattedDate);
        }
    }

    public destroy() {

        // Clean up date change listener
        if (this.unsubscribeDateChanged) {
            this.unsubscribeDateChanged();
            this.unsubscribeDateChanged = null;
        }
        
        if (this.component && this.component.parentElement) {
            this.component.remove();
        }
    }

    private async navigateToAdjacentDay(offset: number): Promise<void> {
        // Update the date state first
        this.dateStateManager.navigateToAdjacentDay(offset);
        
        // Then navigate to the new date
        const state = this.dateStateManager.getState();
        const command = new OpenStreamDateCommand(this.app, this.selectedStream, state.currentDate, this.reuseCurrentTab);
        await command.execute();
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
        
        this.streams.forEach(stream => {
            const streamItem = this.streamsDropdown!.createDiv('streams-calendar-stream-item');
            
            const isSelected = stream.id === this.getActiveStreamId();
            if (isSelected) {
                streamItem.addClass('streams-calendar-stream-item-selected');
            }
            
            const streamIcon = streamItem.createDiv('streams-calendar-stream-item-icon');
            setIcon(streamIcon, stream.icon);
            const streamName = streamItem.createDiv('streams-calendar-stream-item-name');
            streamName.setText(stream.name);
            
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
        this.selectedStream = stream;
        
        if (this.plugin) {
            this.plugin.setActiveStream(stream.id, true);
        }
        
        const changeStreamText = this.component.querySelector('.streams-calendar-change-stream-text');
        if (changeStreamText) {
            changeStreamText.setText(stream.name);
        }
        
        const streamNameElement = this.component.querySelector('.streams-calendar-name');
        if (streamNameElement) {
            streamNameElement.setText(stream.name);
        }
        
        if (this.grid) {
            this.updateGridContent(this.grid);
        }
        
        if (this.streamsDropdown) {
            this.streamsDropdown.style.display = 'none';
        }
        
        if (this.plugin && this.plugin.setActiveStream) {
            this.plugin.setActiveStream(stream.id, true);
        }
        
        this.navigateToStreamDailyNote(stream);
        
        this.refreshStreamsDropdown();
    }

    private async navigateToStreamDailyNote(stream: Stream) {
        try {
            const state = this.dateStateManager.getState();
            const targetDate = state.currentDate;
            
            const command = new OpenStreamDateCommand(this.app, stream, targetDate, this.reuseCurrentTab);
            await command.execute();
        } catch (error) {
            centralizedLogger.error('Error navigating to stream daily note:', error);
        }
    }

    public setCurrentViewedDate(dateString: string): void {
        this.dateStateManager.setCurrentViewedDate(dateString);
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

    private parseViewedDate(dateString: string): Date {
        const [year, month, day] = dateString.split('-').map(n => parseInt(n, 10));
        return new Date(year, month - 1, day);
    }

    private getDaysInMonth(year: number, month: number): number {
        return new Date(year, month, 0).getDate();
    }

    private initializeDateState(leaf: WorkspaceLeaf): void {
        const viewType = leaf.view.getViewType();
        
        if (viewType === 'markdown') {
            const markdownView = leaf.view as MarkdownView;
            const currentFile = markdownView.file;
            if (currentFile) {
                const match = currentFile.basename.match(/^\d{4}-\d{2}-\d{2}/);
                if (match) {
                    const [year, month, day] = match[0].split('-').map(n => parseInt(n, 10));
                    const date = new Date(year, month - 1, day);
                    this.dateStateManager.setCurrentDate(date);
                }
            }
        } else if (viewType === CREATE_FILE_VIEW_TYPE) {
            // For CreateFileView, we'll let the date state manager handle the initial state
            // The CreateFileView will be updated when the date changes
            const state = this.dateStateManager.getState();
            this.dateStateManager.setCurrentDate(state.currentDate);
        }
    }

    private handleDateStateChange(state: any): void {
        // Update the today button display
        this.updateTodayButton();
        
        // Update calendar grid if it exists
        if (this.grid) {
            if (this.grid.children.length > 0) {
                this.updateGridContent(this.grid);
            } else {
                this.updateCalendarGrid(this.grid);
            }
        }
    }

} 