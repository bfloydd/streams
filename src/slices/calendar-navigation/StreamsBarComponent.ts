import { App, WorkspaceLeaf, TFile, MarkdownView, View, Component, setIcon } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { OpenStreamDateCommand } from '../file-operations/OpenStreamDateCommand';
import { OpenTodayCurrentStreamCommand } from '../file-operations/OpenTodayCurrentStreamCommand';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from '../file-operations/CreateFileView';
import { DateStateManager } from '../../shared/date-state-manager';
import { performanceMonitor } from '../../shared/performance-monitor';
import { eventBus, EVENTS } from '../../shared/event-bus';

interface ContentIndicator {
    exists: boolean;
    size: 'small' | 'medium' | 'large';
    isEncrypted?: boolean;
    isLocked?: boolean;
}

// Extended View interface for views with contentEl property
interface ViewWithContentEl extends View {
    contentEl: HTMLElement;
}

interface PluginInterface {
    settings: {
        activeStreamId?: string;
        barStyle?: 'default' | 'modern';
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
    private unsubscribeActiveStreamChanged: (() => void) | null = null;
    private unsubscribeSettingsChanged: (() => void) | null = null;
    private documentClickHandler: ((e: Event) => void) | null = null;
    private calendarClickHandler: ((e: Event) => void) | null = null;
    private lastTouchX: number | null = null;
    private lastTouchY: number | null = null;
    private currentMonthView: Date; // Tracks which month is being displayed in the calendar
    
    // Event handler references for cleanup
    private prevButton: HTMLElement | null = null;
    private nextButton: HTMLElement | null = null;
    private gridWheelHandler: ((e: WheelEvent) => void) | null = null;
    private gridTouchMoveHandler: ((e: TouchEvent) => void) | null = null;
    private gridTouchStartHandler: ((e: TouchEvent) => void) | null = null;
    private prevButtonWheelHandler: ((e: WheelEvent) => void) | null = null;
    private prevButtonTouchHandler: ((e: TouchEvent) => void) | null = null;
    private nextButtonWheelHandler: ((e: WheelEvent) => void) | null = null;
    private nextButtonTouchHandler: ((e: TouchEvent) => void) | null = null;
    
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
    
    private getActiveStream(): Stream {
        if (this.plugin?.settings?.activeStreamId) {
            return this.streams.find(s => s.id === this.plugin!.settings.activeStreamId) || this.selectedStream;
        }
        return this.selectedStream;
    }
    
    private updateStreamEncryptionIcon(container: HTMLElement): void {
        const activeStream = this.getActiveStream();
        
        // Remove existing encryption icon if it exists
        const existingIcon = container.querySelector('.streams-bar-encryption-icon');
        if (existingIcon) {
            existingIcon.remove();
        }
        
        // Add encryption icon if stream is encrypted
        if (activeStream.encryptThisStream) {
            const encryptionIcon = container.createDiv('streams-bar-encryption-icon');
            setIcon(encryptionIcon, 'lock');
            encryptionIcon.setAttribute('title', 'Encrypted stream');
            encryptionIcon.setAttribute('aria-label', 'Encrypted stream');
        }
    }
    
    private applyBarStyle(): void {
        if (!this.plugin?.settings) {
            return;
        }
        
        const barStyle = this.plugin.settings.barStyle;
        
        // Remove existing style classes
        this.component.removeClass('modern-style');
        
        // Apply the appropriate style class
        if (barStyle === 'modern') {
            this.component.addClass('modern-style');
        }
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
        
        // Initialize the month view to the current date
        this.currentMonthView = new Date();
        
        this.component = document.createElement('div');
        this.component.addClass('streams-bar-component');
        
        // Apply the bar style based on settings
        this.applyBarStyle();
        
        // Initialize date state based on current view
        this.initializeDateState(leaf);
        
        // Set up date change listener
        this.unsubscribeDateChanged = this.dateStateManager.onDateChanged((state) => {
            this.handleDateStateChange(state);
        });
        
        // Set up active stream change listener
        this.unsubscribeActiveStreamChanged = eventBus.subscribe(EVENTS.ACTIVE_STREAM_CHANGED, (event) => {
            this.handleActiveStreamChange(event.data);
        });
        
        // Set up settings change listener
        this.unsubscribeSettingsChanged = eventBus.subscribe(EVENTS.SETTINGS_CHANGED, (event) => {
            this.handleSettingsChange(event.data);
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
        
        // Prevent scroll events on the expanded view from interfering with navigation
        expandedView.addEventListener('wheel', (e) => {
            // Only prevent horizontal scroll events that might interfere with month navigation
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });

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
        
        // Add encryption icon if stream is encrypted
        this.updateStreamEncryptionIcon(changeStreamSection);
        
        changeStreamSection.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStreamsDropdown();
        });

        this.streamsDropdown = changeStreamSection.createDiv('streams-bar-streams-dropdown streams-dropdown');
        this.streamsDropdown.style.display = 'none'; // Start hidden
        this.populateStreamsDropdown();

        const topNav = expandedView.createDiv('streams-bar-top-nav');

        const header = expandedView.createDiv('streams-bar-header');
        this.prevButton = header.createDiv('streams-bar-nav');
        this.prevButton.setText('←');
        const dateDisplay = header.createDiv('streams-bar-date');
        const state = this.dateStateManager.getState();
        // Initialize currentMonthView to match the selected date's month
        this.currentMonthView = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
        dateDisplay.setText(this.formatMonthYear(this.currentMonthView));
        this.nextButton = header.createDiv('streams-bar-nav');
        this.nextButton.setText('→');

        const grid = expandedView.createDiv('streams-bar-grid');
        this.grid = grid;
        this.updateCalendarGrid(grid);

        // Prevent scroll events on the calendar grid from interfering with navigation
        this.gridWheelHandler = (e: WheelEvent) => {
            // Only prevent horizontal scroll events that might interfere with month navigation
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        grid.addEventListener('wheel', this.gridWheelHandler, { passive: false });

        // Prevent touch scroll events that might interfere with navigation
        this.gridTouchMoveHandler = (e: TouchEvent) => {
            // Allow vertical scrolling but prevent horizontal scrolling that might trigger navigation
            const touch = e.touches[0];
            if (touch) {
                const deltaX = Math.abs(touch.clientX - (this.lastTouchX || touch.clientX));
                const deltaY = Math.abs(touch.clientY - (this.lastTouchY || touch.clientY));
                
                if (deltaX > deltaY && deltaX > 10) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        grid.addEventListener('touchmove', this.gridTouchMoveHandler, { passive: false });

        this.gridTouchStartHandler = (e: TouchEvent) => {
            const touch = e.touches[0];
            if (touch) {
                this.lastTouchX = touch.clientX;
                this.lastTouchY = touch.clientY;
            }
        };
        grid.addEventListener('touchstart', this.gridTouchStartHandler, { passive: true });

        // Add event handlers to prevent scroll events from triggering navigation
        const handlePrevMonth = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            this.navigateMonth(-1, dateDisplay, grid);
        };

        const handleNextMonth = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            this.navigateMonth(1, dateDisplay, grid);
        };

        // Add click event listeners
        this.prevButton.addEventListener('click', handlePrevMonth);
        this.nextButton.addEventListener('click', handleNextMonth);

        // Add touch event listeners to prevent scroll interference and handle navigation
        this.prevButtonTouchHandler = (e: TouchEvent) => {
            e.preventDefault();
            // Trigger navigation on touchend for mobile
            const handleTouchEnd = (e: TouchEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigateMonth(-1, dateDisplay, grid);
                if (this.prevButton) {
                    this.prevButton.removeEventListener('touchend', handleTouchEnd);
                }
            };
            if (this.prevButton) {
                this.prevButton.addEventListener('touchend', handleTouchEnd, { passive: false });
            }
        };
        this.prevButton.addEventListener('touchstart', this.prevButtonTouchHandler, { passive: false });

        this.nextButtonTouchHandler = (e: TouchEvent) => {
            e.preventDefault();
            // Trigger navigation on touchend for mobile
            const handleTouchEnd = (e: TouchEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigateMonth(1, dateDisplay, grid);
                if (this.nextButton) {
                    this.nextButton.removeEventListener('touchend', handleTouchEnd);
                }
            };
            if (this.nextButton) {
                this.nextButton.addEventListener('touchend', handleTouchEnd, { passive: false });
            }
        };
        this.nextButton.addEventListener('touchstart', this.nextButtonTouchHandler, { passive: false });

        // Add wheel event listeners to prevent scroll from triggering navigation
        this.prevButtonWheelHandler = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        this.prevButton.addEventListener('wheel', this.prevButtonWheelHandler, { passive: false });

        this.nextButtonWheelHandler = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        this.nextButton.addEventListener('wheel', this.nextButtonWheelHandler, { passive: false });


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
        let file = this.app.vault.getAbstractFileByPath(filePath);
        let isEncrypted = false;

        // If file not found, check for encrypted version (.mdenc)
        if (!file) {
            const encryptedFilePath = filePath.replace(/\.md$/, '.mdenc');
            file = this.app.vault.getAbstractFileByPath(encryptedFilePath);
            isEncrypted = true;
        }

        if (!(file instanceof TFile)) {
            return { exists: false, size: 'small' };
        }

        // Check if file is encrypted by extension or content
        if (!isEncrypted) {
            isEncrypted = file.path.endsWith('.mdenc') || await this.isFileEncrypted(file);
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

        // Determine if encrypted file is locked or unlocked
        let isLocked = false;
        if (isEncrypted) {
            isLocked = await this.isEncryptedFileLocked(file);
        }

        return { 
            exists: true, 
            size, 
            isEncrypted, 
            isLocked 
        };
    }

    /**
     * Check if a file is encrypted by examining its content
     */
    private async isFileEncrypted(file: TFile): Promise<boolean> {
        try {
            const content = await this.app.vault.read(file);
            return this.isEncryptedContent(content);
        } catch (error) {
            centralizedLogger.error('Error reading file content for encryption check:', error);
            return false;
        }
    }

    /**
     * Check if file content appears to be encrypted
     */
    private isEncryptedContent(content: string): boolean {
        // Common patterns that indicate encrypted content
        const encryptedPatterns = [
            /^-----BEGIN PGP MESSAGE-----/,
            /^-----BEGIN ENCRYPTED MESSAGE-----/,
            /^-----BEGIN MESSAGE-----/,
            /^U2FsdGVkX1/, // Base64 encoded encrypted content (common in some encryption tools)
            /^[A-Za-z0-9+/]{100,}={0,2}$/ // Long base64 strings (potential encrypted content)
        ];

        return encryptedPatterns.some(pattern => pattern.test(content.trim()));
    }

    /**
     * Check if an encrypted file is currently locked (requires decryption to access)
     */
    private async isEncryptedFileLocked(file: TFile): Promise<boolean> {
        try {
            // Check if Meld plugin is available
            if (!this.isMeldPluginAvailable()) {
                // If Meld is not available, consider the file locked
                return true;
            }

            // Try to read the file content to see if it's accessible
            const content = await this.app.vault.read(file);
            
            // If we can read the content and it's not encrypted patterns, it's unlocked
            if (content && !this.isEncryptedContent(content)) {
                return false;
            }

            // If content contains encrypted patterns, it's locked
            return this.isEncryptedContent(content);
        } catch (error) {
            // If we can't read the file, consider it locked
            centralizedLogger.debug('Could not read encrypted file, considering it locked:', error);
            return true;
        }
    }

    /**
     * Check if Meld plugin is available
     */
    private isMeldPluginAvailable(): boolean {
        try {
            // Check if the Meld plugin is installed and enabled
            const plugins = (this.app as any).plugins?.plugins;
            if (!plugins) return false;
            
            // Check for Meld plugin
            const meldPlugin = plugins['meld-encrypt'];
            if (!meldPlugin) return false;
            
            // Check if the specific command exists
            const commands = (this.app as any).commands?.commands;
            if (!commands) return false;
            
            return !!commands['meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note'];
        } catch (error) {
            centralizedLogger.error('Error checking Meld plugin availability:', error);
            return false;
        }
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
        const currentDate = this.currentMonthView; // Use the month view instead of selected date
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
            const currentDate = this.currentMonthView; // Use the month view instead of selected date
            
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
        const selectedDate = new Date(this.currentMonthView.getFullYear(), this.currentMonthView.getMonth(), day);
        
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

    /**
     * Navigate to a different month in the calendar view
     * @param direction -1 for previous month, 1 for next month
     * @param dateDisplay - The date display element to update
     * @param grid - The calendar grid element to update
     */
    private navigateMonth(direction: number, dateDisplay: HTMLElement, grid: HTMLElement): void {
        // Only change the month view, not the selected date
        this.currentMonthView.setMonth(this.currentMonthView.getMonth() + direction);
        dateDisplay.setText(this.formatMonthYear(this.currentMonthView));
        
        if (grid.children.length > 0) {
            this.updateGridContent(grid);
        } else {
            this.updateCalendarGrid(grid);
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
        
        // Clean up active stream change listener
        if (this.unsubscribeActiveStreamChanged) {
            this.unsubscribeActiveStreamChanged();
            this.unsubscribeActiveStreamChanged = null;
        }
        
        // Clean up settings change listener
        if (this.unsubscribeSettingsChanged) {
            this.unsubscribeSettingsChanged();
            this.unsubscribeSettingsChanged = null;
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
        
        // Clean up scroll prevention event listeners
        if (this.grid && this.gridWheelHandler && this.gridTouchMoveHandler && this.gridTouchStartHandler) {
            this.grid.removeEventListener('wheel', this.gridWheelHandler);
            this.grid.removeEventListener('touchmove', this.gridTouchMoveHandler);
            this.grid.removeEventListener('touchstart', this.gridTouchStartHandler);
        }
        
        // Clean up navigation button event listeners
        if (this.prevButton && this.prevButtonWheelHandler && this.prevButtonTouchHandler) {
            this.prevButton.removeEventListener('wheel', this.prevButtonWheelHandler);
            this.prevButton.removeEventListener('touchstart', this.prevButtonTouchHandler);
        }
        if (this.nextButton && this.nextButtonWheelHandler && this.nextButtonTouchHandler) {
            this.nextButton.removeEventListener('wheel', this.nextButtonWheelHandler);
            this.nextButton.removeEventListener('touchstart', this.nextButtonTouchHandler);
        }
        
        // Clean up references
        this.prevButton = null;
        this.nextButton = null;
        this.gridWheelHandler = null;
        this.gridTouchMoveHandler = null;
        this.gridTouchStartHandler = null;
        this.prevButtonWheelHandler = null;
        this.prevButtonTouchHandler = null;
        this.nextButtonWheelHandler = null;
        this.nextButtonTouchHandler = null;
        this.lastTouchX = null;
        this.lastTouchY = null;
        
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
        
        // Filter out disabled streams
        const enabledStreams = this.streams.filter(stream => !stream.disabled);
        
        enabledStreams.forEach(stream => {
            const streamItem = this.streamsDropdown!.createDiv('streams-bar-stream-item');
            
            const isSelected = stream.id === this.getActiveStreamId();
            if (isSelected) {
                streamItem.addClass('streams-bar-stream-item-selected');
            }
            
            const streamIcon = streamItem.createDiv('streams-bar-stream-item-icon');
            setIcon(streamIcon, stream.icon);
            const streamName = streamItem.createDiv('streams-bar-stream-item-name');
            streamName.setText(stream.name);
            
            // Add encryption icon if stream is encrypted
            if (stream.encryptThisStream) {
                const encryptionIcon = streamItem.createDiv('streams-bar-stream-item-encryption');
                setIcon(encryptionIcon, 'lock');
                encryptionIcon.setAttribute('title', 'Encrypted stream');
                encryptionIcon.setAttribute('aria-label', 'Encrypted stream');
            }
            
            if (isSelected) {
                const checkmark = streamItem.createDiv('streams-bar-stream-item-checkmark');
                setIcon(checkmark, 'check');
            }
            
            streamItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectStream(stream);
            });
        });
        
        // Force a reflow on mobile devices to ensure the dropdown updates immediately
        if (this.streamsDropdown) {
            // Trigger a reflow to ensure the changes are visible
            this.streamsDropdown.offsetHeight;
        }
    }

    private selectStream(stream: Stream) {
        // Update the plugin's active stream - this will trigger the event listener
        if (this.plugin) {
            this.plugin.setActiveStream(stream.id, true);
        }
        
        this.hideStreamsDropdown();
        
        this.navigateToStreamDailyNote(stream);
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
            
            // Force immediate DOM update for mobile devices
            // Use requestAnimationFrame to ensure the DOM is updated
            requestAnimationFrame(() => {
                // Trigger a reflow to ensure the changes are visible
                this.streamsDropdown?.offsetHeight;
            });
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

                    // Add encryption status icon if file is encrypted
                    if (content.isEncrypted) {
                        const encryptionIcon = document.createElement('div');
                        encryptionIcon.className = 'streams-encryption-icon';
                        
                        // Set the appropriate icon based on lock status
                        if (content.isLocked) {
                            setIcon(encryptionIcon, 'lock');
                            encryptionIcon.setAttribute('title', 'Encrypted file (locked)');
                        } else {
                            setIcon(encryptionIcon, 'unlock');
                            encryptionIcon.setAttribute('title', 'Encrypted file (unlocked)');
                        }
                        
                        dotContainer.appendChild(encryptionIcon);
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
        
        // Update the month view to match the selected date's month
        this.currentMonthView = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
        
        // Update calendar grid if it exists
        if (this.grid) {
            if (this.grid.children.length > 0) {
                this.updateGridContent(this.grid);
            } else {
                this.updateCalendarGrid(this.grid);
            }
        }
    }

    private handleActiveStreamChange(eventData: any): void {
        const { streamId } = eventData;
        
        if (!streamId) {
            return;
        }
        
        // Find the new active stream
        const newActiveStream = this.streams.find(s => s.id === streamId);
        if (!newActiveStream) {
            centralizedLogger.warn(`Active stream changed to unknown stream ID: ${streamId}`);
            return;
        }
        
        // Update the selected stream
        this.selectedStream = newActiveStream;
        
        // Update the display stream name
        const changeStreamText = this.component.querySelector('.streams-bar-change-stream-text');
        if (changeStreamText) {
            changeStreamText.setText(newActiveStream.name);
        }
        
        // Update the encryption icon
        const changeStreamSection = this.component.querySelector('.streams-bar-change-stream');
        if (changeStreamSection) {
            this.updateStreamEncryptionIcon(changeStreamSection as HTMLElement);
        }
        
        
        // Update the calendar grid to reflect the new stream's content
        if (this.grid) {
            this.updateGridContent(this.grid);
        }
        
        // Refresh the streams dropdown to show the correct selection
        this.refreshStreamsDropdown();
    }
    
    private handleSettingsChange(settings: any): void {
        // Apply the new bar style if it changed
        this.applyBarStyle();
        
        // Update streams list if it changed
        if (settings.streams) {
            this.streams = settings.streams;
            this.refreshStreamsDropdown();
        }
    }
    
    public refreshBarStyle(): void {
        this.applyBarStyle();
    }

} 