import { App, WorkspaceLeaf, TFile, MarkdownView, View, Component, setIcon } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { OpenStreamDateCommand } from '../file-operations/OpenStreamDateCommand';
import { OpenTodayStreamCommand } from '../file-operations/OpenTodayStreamCommand';
import { OpenTodayCurrentStreamCommand } from '../file-operations/OpenTodayCurrentStreamCommand';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from '../file-operations/CreateFileView';
import { DateStateManager } from '../../shared/date-state-manager';
import { performanceMonitor } from '../../shared/performance-monitor';

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

export class StreamsBarComponent extends Component {
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
    private documentClickHandler: ((e: Event) => void) | null = null;
    private calendarClickHandler: ((e: Event) => void) | null = null;
    
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

    public updateReuseCurrentTab(reuseCurrentTab: boolean): void {
        this.reuseCurrentTab = reuseCurrentTab;
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
        this.component.addClass('streams-bar-component');
        
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
        const leafContainer = leaf.view.containerEl;
        const existingComponents = leafContainer.querySelectorAll('.streams-bar-component');
        existingComponents.forEach(component => {
            component.remove();
        });

        contentContainer.addClass('streams-markdown-view-content');
        
        // Get the main editor area for validation
        const mainEditorArea = document.querySelector('.workspace-split.mod-vertical.mod-root');
        
        // Only add the calendar component if we're in the main editor area
        const isMainEditorLeaf = mainEditorArea && mainEditorArea.contains(leaf.view.containerEl);
        
        if (isMainEditorLeaf) {
            // Apply standard calendar component styling
            this.component.addClass('streams-bar-component');
            
            // Attach directly to the leaf's container element to ensure it stays with the specific editor window
            const leafContainer = leaf.view.containerEl;
            
            // Find the view-header within this specific leaf
            const viewHeader = leafContainer.querySelector('.view-header');
            
            if (viewHeader && viewHeader.parentElement) {
                // Insert after the view-header for this specific leaf
                viewHeader.parentElement.insertBefore(this.component, viewHeader.nextSibling);
            } else {
                // Fallback: attach to the leaf container itself
                leafContainer.insertBefore(this.component, leafContainer.firstChild);
            }
        } else {
            // Don't add calendar component to sidebars or other panes
            centralizedLogger.debug('Calendar component not added - not in main editor area');
            this.component.remove();
            return;
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

        const collapsedView = this.component.createDiv('streams-bar-collapsed');
        const expandedView = this.component.createDiv('streams-bar-expanded');

        const navControls = collapsedView.createDiv('streams-bar-nav-controls');
        
        const prevDayButton = navControls.createDiv('streams-bar-day-nav prev-day');
        prevDayButton.setText('←');
        prevDayButton.setAttribute('aria-label', 'Previous day');
        prevDayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.navigateToAdjacentDay(-1);
        });
        
        const todayButton = navControls.createDiv('streams-bar-today-button');
        this.todayButton = todayButton;
        this.updateTodayButton();
        
        todayButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(collapsedView, expandedView);
        });
        
        const nextDayButton = navControls.createDiv('streams-bar-day-nav next-day');
        nextDayButton.setText('→');
        nextDayButton.setAttribute('aria-label', 'Next day');
        nextDayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.navigateToAdjacentDay(1);
        });
        
        const homeButton = navControls.createDiv('streams-bar-home-button');
        setIcon(homeButton, 'home');
        homeButton.setAttribute('aria-label', 'Go to current stream today');
        homeButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            const command = new OpenTodayCurrentStreamCommand(this.app, this.streams, this.reuseCurrentTab, this.plugin);
            await command.execute();
        });
        
        const settingsButton = navControls.createDiv('streams-bar-settings-button');
        setIcon(settingsButton, 'settings');
        settingsButton.setAttribute('aria-label', 'Open Streams plugin settings');
        settingsButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            const setting = (this.app as any).setting;
            setting.open();
            setting.openTabById('streams');
        });

        const changeStreamSection = collapsedView.createDiv('streams-bar-change-stream');
        const changeStreamText = changeStreamSection.createDiv('streams-bar-change-stream-text');
        changeStreamText.setText(this.getDisplayStreamName());
        changeStreamSection.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStreamsDropdown();
        });

        this.streamsDropdown = changeStreamSection.createDiv('streams-bar-streams-dropdown streams-dropdown');
        this.streamsDropdown.style.display = 'none'; // Start hidden
        this.populateStreamsDropdown();

        const topNav = expandedView.createDiv('streams-bar-top-nav');
        const todayNavButton = topNav.createDiv('streams-bar-today-nav');
        todayNavButton.setText('Today');
        const streamName = topNav.createDiv('streams-bar-name');
        streamName.setText(this.getDisplayStreamName());

        const header = expandedView.createDiv('streams-bar-header');
        const prevButton = header.createDiv('streams-bar-nav');
        prevButton.setText('←');
        const dateDisplay = header.createDiv('streams-bar-date');
        const state = this.dateStateManager.getState();
        dateDisplay.setText(this.formatMonthYear(state.currentDate));
        const nextButton = header.createDiv('streams-bar-nav');
        nextButton.setText('→');

        const grid = expandedView.createDiv('streams-bar-grid');
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

        // Store the click handler reference for cleanup
        this.documentClickHandler = (e: Event) => {
            if (this.expanded && !this.component.contains(e.target as Node)) {
                this.toggleExpanded(collapsedView, expandedView);
            }
            
            // Only close dropdown if it's visible and click is outside the component
            if (this.streamsDropdown && this.streamsDropdown.style.display !== 'none' && !this.component.contains(e.target as Node)) {
                this.hideStreamsDropdown();
            }
        };
        
        document.addEventListener('click', this.documentClickHandler);

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
        this.component.addClass('streams-bar-component--visible');

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
        const endTiming = performanceMonitor.startTiming('calendar-grid-update');
        
        try {
            if (grid.children.length > 0) {
                await this.updateGridContent(grid);
                return;
            }
            
            // Use DocumentFragment for batch DOM operations
            const fragment = document.createDocumentFragment();
        
        const state = this.dateStateManager.getState();
        const currentDate = state.currentDate;
        const daysInMonth = this.getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
        
        // Create day headers
        for (let i = 0; i < 7; i++) {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'streams-bar-day-header';
            dayHeader.textContent = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][i];
            fragment.appendChild(dayHeader);
        }
        
        // Create empty day placeholders
        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'streams-bar-day empty';
            fragment.appendChild(emptyDay);
        }
        
        // Batch create all day elements and prepare content indicators
        const dayElements: HTMLElement[] = [];
        const contentPromises: Promise<ContentIndicator>[] = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'streams-bar-day';
            dayEl.setAttribute('data-day', String(day));
            
            const dateContainer = document.createElement('div');
            dateContainer.className = 'streams-date-container';
            dateContainer.textContent = String(day);
            dayEl.appendChild(dateContainer);
            
            const dotContainer = document.createElement('div');
            dotContainer.className = 'streams-dot-container';
            dayEl.appendChild(dotContainer);
            
            dayElements.push(dayEl);
            fragment.appendChild(dayEl);
            
            // Prepare content indicator promise
            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            contentPromises.push(this.getContentIndicator(dayDate));
        }
        
        // Clear grid and append all elements at once
        grid.empty();
        grid.appendChild(fragment);
        
        // Process content indicators and apply styles in batch
        const contentIndicators = await Promise.all(contentPromises);
        
        // Batch apply styles and content
        this.applyDayStylesAndContent(dayElements, contentIndicators, currentDate, state);
        
        // Use event delegation for better performance
        this.setupCalendarEventDelegation(grid);
        
        } finally {
            endTiming();
        }
    }
    
    private async updateGridContent(grid: HTMLElement) {
        const endTiming = performanceMonitor.startTiming('calendar-grid-content-update');
        
        try {
            const dayElements = Array.from(grid.querySelectorAll('.streams-bar-day:not(.empty)')) as HTMLElement[];
            const state = this.dateStateManager.getState();
            const currentDate = state.currentDate;
            
            // Batch prepare all content indicators
            const contentPromises = dayElements.map((dayEl, i) => {
                const day = i + 1;
                const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                return this.getContentIndicator(dayDate);
            });
            
            // Wait for all content indicators to load
            const contentIndicators = await Promise.all(contentPromises);
            
            // Batch apply all updates
            this.applyDayStylesAndContent(dayElements, contentIndicators, currentDate, state);
        } finally {
            endTiming();
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
        
        // Close the expanded calendar after selecting a date
        if (this.expanded) {
            const collapsedView = this.component.querySelector('.streams-bar-collapsed') as HTMLElement;
            const expandedView = this.component.querySelector('.streams-bar-expanded') as HTMLElement;
            if (collapsedView && expandedView) {
                this.toggleExpanded(collapsedView, expandedView);
            }
        }
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.toggleClass('streams-bar-expanded-active', this.expanded);
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
        
        // Clean up document click handler
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler);
            this.documentClickHandler = null;
        }
        
        // Clean up calendar click handler
        if (this.calendarClickHandler && this.grid) {
            this.grid.removeEventListener('click', this.calendarClickHandler);
            this.grid.removeEventListener('touchend', this.calendarClickHandler, { passive: true } as AddEventListenerOptions);
            this.calendarClickHandler = null;
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
            if (isVisible) {
                this.hideStreamsDropdown();
            } else {
                this.showStreamsDropdown();
            }
        }
    }

    private showStreamsDropdown() {
        if (this.streamsDropdown) {
            this.streamsDropdown.style.display = 'block';
            this.streamsDropdown.addClass('streams-dropdown--visible');
        }
    }

    private hideStreamsDropdown() {
        if (this.streamsDropdown) {
            this.streamsDropdown.style.display = 'none';
            this.streamsDropdown.removeClass('streams-dropdown--visible');
        }
    }

    private populateStreamsDropdown() {
        if (!this.streamsDropdown) return;
        
        this.streamsDropdown.empty();
        
        this.streams.forEach(stream => {
            const streamItem = this.streamsDropdown!.createDiv('streams-bar-stream-item');
            
            const isSelected = stream.id === this.getActiveStreamId();
            if (isSelected) {
                streamItem.addClass('streams-bar-stream-item-selected');
            }
            
            const streamIcon = streamItem.createDiv('streams-bar-stream-item-icon');
            setIcon(streamIcon, stream.icon);
            const streamName = streamItem.createDiv('streams-bar-stream-item-name');
            streamName.setText(stream.name);
            
            if (isSelected) {
                const checkmark = streamItem.createDiv('streams-bar-stream-item-checkmark');
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
        
        const changeStreamText = this.component.querySelector('.streams-bar-change-stream-text');
        if (changeStreamText) {
            changeStreamText.setText(stream.name);
        }
        
        const streamNameElement = this.component.querySelector('.streams-bar-name');
        if (streamNameElement) {
            streamNameElement.setText(stream.name);
        }
        
        if (this.grid) {
            this.updateGridContent(this.grid);
        }
        
        this.hideStreamsDropdown();
        
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

    /**
     * Batch apply styles and content to day elements for optimal performance
     */
    private applyDayStylesAndContent(
        dayElements: HTMLElement[], 
        contentIndicators: ContentIndicator[], 
        currentDate: Date, 
        state: any
    ): void {
        // Use requestAnimationFrame to batch DOM updates
        requestAnimationFrame(() => {
            dayElements.forEach((dayEl, i) => {
                const day = i + 1;
                const content = contentIndicators[i];
                const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dateString = this.formatDateString(dayDate);
                
                // Get dot container once
                const dotContainer = dayEl.querySelector('.streams-dot-container') as HTMLElement;
                
                // Clear existing dots
                if (dotContainer) {
                    dotContainer.innerHTML = '';
                }
                
                // Apply classes efficiently
                const classList = dayEl.classList;
                classList.remove('viewed', 'today');
                
                if (dateString === state.currentViewedDate) {
                    classList.add('viewed');
                }
                
                if (this.isToday(dayDate)) {
                    classList.add('today');
                }
                
                // Add content dots if needed
                if (content.exists && dotContainer) {
                    const dots = content.size === 'small' ? 1 : content.size === 'medium' ? 2 : 3;
                    for (let j = 0; j < dots; j++) {
                        const dot = document.createElement('div');
                        dot.className = 'streams-content-dot';
                        dotContainer.appendChild(dot);
                    }
                }
            });
        });
    }

    /**
     * Setup event delegation for calendar day clicks for better performance
     */
    private setupCalendarEventDelegation(grid: HTMLElement): void {
        // Remove existing event listeners to prevent duplicates
        if (this.calendarClickHandler) {
            grid.removeEventListener('click', this.calendarClickHandler);
            grid.removeEventListener('touchend', this.calendarClickHandler, { passive: true } as AddEventListenerOptions);
        }
        
        // Create single event handler for all day clicks
        this.calendarClickHandler = (e: Event) => {
            const target = e.target as HTMLElement;
            const dayEl = target.closest('.streams-bar-day:not(.empty)') as HTMLElement;
            
            if (dayEl) {
                e.preventDefault();
                e.stopPropagation();
                
                const day = parseInt(dayEl.getAttribute('data-day') || '0', 10);
                if (day > 0) {
                    this.selectDate(day);
                }
            }
        };
        
        // Add event listeners to grid container
        grid.addEventListener('click', this.calendarClickHandler);
        grid.addEventListener('touchend', this.calendarClickHandler, { passive: true } as AddEventListenerOptions);
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