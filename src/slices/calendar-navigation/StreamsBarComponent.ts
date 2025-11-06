import { App, WorkspaceLeaf, TFile, MarkdownView, View, Component, setIcon, Plugin } from 'obsidian';
import { Stream, StreamsSettings } from '../../shared/types';
import { DateState } from '../../shared/date-state-manager';
import { centralizedLogger } from '../../shared/centralized-logger';
import { StreamsPluginInterface } from '../../shared/interfaces';
import { OpenStreamDateCommand } from '../file-operations/OpenStreamDateCommand';
import { OpenTodayCurrentStreamCommand } from '../file-operations/OpenTodayCurrentStreamCommand';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from '../file-operations/CreateFileView';
import { INSTALL_MELD_VIEW_TYPE } from '../file-operations/InstallMeldView';
import { CREATE_FILE_VIEW_ENCRYPTED_TYPE } from '../file-operations/CreateFileViewEncrypted';
import { DateStateManager } from '../../shared/date-state-manager';
import { performanceMonitor } from '../../shared/performance-monitor';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { encryptionDetectionService } from '../../shared/encryption-detection-service';
import { MeldDetectionService } from '../meld-integration';
import { TIMING } from '../../shared/timing-constants';
import { getSetting, getPluginById } from '../../shared/obsidian-types';
import { CalendarRenderer } from './CalendarRenderer';
import { StreamSelector } from './StreamSelector';
import { ContentIndicatorService, ContentIndicator } from './ContentIndicatorService';
import { DateNavigationService } from './DateNavigationService';
import { EventHandlerRegistry } from '../../shared/event-handler-registry';
import { TouchGestureHandler } from './TouchGestureHandler';
import { DocumentEventHandler } from './DocumentEventHandler';

// ContentIndicator interface moved to ContentIndicatorService

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
    setActiveStream(streamId: string, force?: boolean): Promise<void>;
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
    private meldDetectionService: MeldDetectionService;
    
    // Extracted services and components
    private contentIndicatorService: ContentIndicatorService;
    private dateNavigationService: DateNavigationService;
    private calendarRenderer: CalendarRenderer | null = null;
    private streamSelector: StreamSelector | null = null;
    private eventRegistry: EventHandlerRegistry;
    private unsubscribeDateChanged: (() => void) | null = null;
    private unsubscribeActiveStreamChanged: (() => void) | null = null;
    private unsubscribeSettingsChanged: (() => void) | null = null;
    private touchGestureHandler: TouchGestureHandler | null = null;
    private documentEventHandler: DocumentEventHandler | null = null;
    private currentMonthView: Date; // Tracks which month is being displayed in the calendar
    private timeoutIds: number[] = []; // Store timeout IDs for cleanup
    
    // Cached DOM elements for better performance
    private collapsedView: HTMLElement | null = null;
    private expandedView: HTMLElement | null = null;
    private changeStreamSection: HTMLElement | null = null;
    private changeStreamText: HTMLElement | null = null;
    private dateDisplay: HTMLElement | null = null;
    
    // Event handler references for cleanup
    private prevButton: HTMLElement | null = null;
    private nextButton: HTMLElement | null = null;
    
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
        
        // Initialize Meld detection service
        this.meldDetectionService = new MeldDetectionService();
        if (plugin) {
            // Cast to Plugin for MeldDetectionService which expects Plugin type
            this.meldDetectionService.setPlugin(plugin as unknown as Plugin);
            // Initialize asynchronously (fire and forget)
            this.meldDetectionService.initialize().catch(error => {
                centralizedLogger.error('Error initializing MeldDetectionService:', error);
            });
        }
        
        // Initialize extracted services
        this.contentIndicatorService = new ContentIndicatorService(app, stream, this.meldDetectionService);
        this.dateNavigationService = new DateNavigationService(app, stream, reuseCurrentTab);
        this.eventRegistry = new EventHandlerRegistry();
        
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
            
        } else if (viewType === CREATE_FILE_VIEW_TYPE || 
                   viewType === INSTALL_MELD_VIEW_TYPE || 
                   viewType === CREATE_FILE_VIEW_ENCRYPTED_TYPE) {
            const view = leaf.view as unknown as ViewWithContentEl;
            if (!view) {
                centralizedLogger.error(`View is null for viewType: ${viewType}`);
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
        
        if (isInStream && this.calendarRenderer) {
            this.calendarRenderer.updateGridContent();
            this.updateTodayButton();
        }
    }

    private initializeComponent() {
        this.collapsedView = this.component.createDiv('streams-bar-collapsed');
        this.expandedView = this.component.createDiv('streams-bar-expanded');
        
        this.setupExpandedViewScroll(this.expandedView);
        this.setupCollapsedView(this.collapsedView);
        this.setupExpandedView(this.expandedView);
        this.setupCalendarHandlers(this.expandedView);
        
        // Setup document handlers after all UI elements are created
        this.setupDocumentHandlers(this.collapsedView, this.expandedView);
        
        // Force a re-render by triggering a layout recalculation
        this.component.offsetHeight; // Force layout
        this.component.addClass('streams-bar-component--visible');
    }

    private setupExpandedViewScroll(expandedView: HTMLElement): void {
        // Prevent scroll events on the expanded view from interfering with navigation
        this.eventRegistry.register(expandedView, 'wheel', (e: WheelEvent) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
    }

    private setupCollapsedView(collapsedView: HTMLElement): void {
        const navControls = collapsedView.createDiv('streams-bar-nav-controls');
        this.setupNavigationControls(navControls, collapsedView);
        this.setupStreamSelector(collapsedView);
    }

    private setupNavigationControls(navControls: HTMLElement, collapsedView: HTMLElement): void {
        const prevDayButton = navControls.createDiv('streams-bar-day-nav prev-day');
        prevDayButton.setText('←');
        prevDayButton.setAttribute('aria-label', 'Previous day');
        this.eventRegistry.register(prevDayButton, 'click', async (e: Event) => {
            e.stopPropagation();
            await this.navigateToAdjacentDay(-1);
        });
        
        const todayButton = navControls.createDiv('streams-bar-today-button');
        this.todayButton = todayButton;
        this.updateTodayButton();
        
        this.eventRegistry.register(todayButton, 'click', (e: Event) => {
            e.stopPropagation();
            if (this.streamSelector && this.streamSelector.isVisible()) {
                this.hideStreamsDropdown();
            }
            if (this.collapsedView && this.expandedView) {
                this.toggleExpanded(this.collapsedView, this.expandedView);
            }
        });
        
        const nextDayButton = navControls.createDiv('streams-bar-day-nav next-day');
        nextDayButton.setText('→');
        nextDayButton.setAttribute('aria-label', 'Next day');
        this.eventRegistry.register(nextDayButton, 'click', async (e: Event) => {
            e.stopPropagation();
            await this.navigateToAdjacentDay(1);
        });
        
        this.setupHomeButton(navControls);
        this.setupSettingsButton(navControls);
    }

    private setupHomeButton(navControls: HTMLElement): void {
        const homeButton = navControls.createDiv('streams-bar-home-button');
        setIcon(homeButton, 'home');
        homeButton.setAttribute('aria-label', 'Go to current stream today');
        this.eventRegistry.register(homeButton, 'click', async (e: Event) => {
            e.stopPropagation();
            const command = new OpenTodayCurrentStreamCommand(this.app, this.streams, this.reuseCurrentTab, (this.plugin ?? undefined) as StreamsPluginInterface | undefined);
            await command.execute();
        });
    }

    private setupSettingsButton(navControls: HTMLElement): void {
        const settingsButton = navControls.createDiv('streams-bar-settings-button');
        setIcon(settingsButton, 'settings');
        settingsButton.setAttribute('aria-label', 'Open Streams plugin settings');
        this.eventRegistry.register(settingsButton, 'click', async (e: Event) => {
            e.stopPropagation();
            const setting = getSetting(this.app);
            if (setting) {
                setting.open?.();
                setting.openTabById?.('streams');
            }
        });
    }

    private setupStreamSelector(collapsedView: HTMLElement): void {
        this.changeStreamSection = collapsedView.createDiv('streams-bar-change-stream');
        this.changeStreamText = this.changeStreamSection.createDiv('streams-bar-change-stream-text');
        this.changeStreamText.setText(this.getDisplayStreamName());
        
        this.updateStreamEncryptionIcon(this.changeStreamSection);
        
        this.eventRegistry.register(this.changeStreamSection, 'click', (e: Event) => {
            e.stopPropagation();
            if (this.expanded && this.collapsedView && this.expandedView) {
                this.toggleExpanded(this.collapsedView, this.expandedView);
            }
            this.toggleStreamsDropdown();
        });

        this.streamsDropdown = this.changeStreamSection.createDiv('streams-bar-streams-dropdown streams-dropdown streams-bar-dropdown-hidden');
        
        this.streamSelector = new StreamSelector(
            this.streamsDropdown,
            this.streams,
            this.getActiveStreamId(),
            this.app,
            this.plugin,
            this.reuseCurrentTab,
            () => {
                // Dropdown will be closed by StreamSelector
            }
        );
        this.streamSelector.populateStreamsDropdown();
        
        this.eventRegistry.register(this.streamsDropdown, 'click', (e: Event) => {
            if (this.expanded && this.collapsedView && this.expandedView) {
                this.toggleExpanded(this.collapsedView, this.expandedView);
            }
        });
    }

    private setupExpandedView(expandedView: HTMLElement): void {
        const topNav = expandedView.createDiv('streams-bar-top-nav');

        const header = expandedView.createDiv('streams-bar-header');
        this.prevButton = header.createDiv('streams-bar-nav');
        this.prevButton.setText('←');
        
        this.dateDisplay = header.createDiv('streams-bar-date');
        const state = this.dateStateManager.getState();
        this.currentMonthView = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
        this.dateDisplay.setText(this.dateNavigationService.formatMonthYear(this.currentMonthView));
        
        this.nextButton = header.createDiv('streams-bar-nav');
        this.nextButton.setText('→');

        this.grid = expandedView.createDiv('streams-bar-grid');
        
        // Initialize calendar renderer component
        this.calendarRenderer = new CalendarRenderer(
            this.grid,
            this.contentIndicatorService,
            this.dateNavigationService,
            this.currentMonthView,
            async (day: number) => {
                await this.dateNavigationService.selectDate(this.currentMonthView, day);
                if (this.expanded && this.collapsedView && this.expandedView) {
                    this.toggleExpanded(this.collapsedView, this.expandedView);
                }
            },
            () => {
                if (this.streamSelector) {
                    this.streamSelector.hide();
                }
            }
        );
        this.calendarRenderer.updateCalendarGrid();
    }

    private setupCalendarHandlers(expandedView: HTMLElement): void {
        if (!this.grid || !this.prevButton || !this.nextButton || !this.dateDisplay) return;
        
        // Initialize touch gesture handler
        this.touchGestureHandler = new TouchGestureHandler(
            this.eventRegistry,
            (direction: number) => {
                if (this.dateDisplay) {
                    this.navigateMonth(direction, this.dateDisplay);
                }
            }
        );
        
        // Setup grid scroll handlers
        this.touchGestureHandler.setupGridScrollHandlers(this.grid);
        
        // Setup month navigation click handlers
        const handlePrevMonth = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.dateDisplay) {
                this.navigateMonth(-1, this.dateDisplay);
            }
        };

        const handleNextMonth = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.dateDisplay) {
                this.navigateMonth(1, this.dateDisplay);
            }
        };

        this.eventRegistry.register(this.prevButton, 'click', handlePrevMonth);
        this.eventRegistry.register(this.nextButton, 'click', handleNextMonth);

        // Setup touch and wheel navigation handlers
        this.touchGestureHandler.setupTouchNavigationHandlers(this.prevButton, this.nextButton, this.dateDisplay);
        this.touchGestureHandler.setupWheelNavigationHandlers(this.prevButton, this.nextButton);
    }

    private setupDocumentHandlers(collapsedView: HTMLElement, expandedView: HTMLElement): void {
        // Initialize document event handler after all UI elements are created
        this.documentEventHandler = new DocumentEventHandler(
            this.eventRegistry,
            this.todayButton,
            this.changeStreamSection,
            this.streamsDropdown,
            this.expandedView,
            this.streamSelector,
            () => {
                if (this.collapsedView && this.expandedView) {
                    this.toggleExpanded(this.collapsedView, this.expandedView);
                }
            },
            () => {
                this.hideStreamsDropdown();
            }
        );
        
        this.documentEventHandler.setupDocumentHandlers();
    }

    // Content indicator methods moved to ContentIndicatorService
    // Calendar grid methods moved to CalendarRenderer

    // Date formatting methods moved to DateNavigationService

    /**
     * Navigate to a different month in the calendar view
     * @param direction -1 for previous month, 1 for next month
     * @param dateDisplay - The date display element to update
     */
    private navigateMonth(direction: number, dateDisplay: HTMLElement): void {
        // Only change the month view, not the selected date
        this.dateNavigationService.navigateMonth(this.currentMonthView, direction);
        dateDisplay.setText(this.dateNavigationService.formatMonthYear(this.currentMonthView));
        
        if (this.calendarRenderer) {
            this.calendarRenderer.setMonthView(this.currentMonthView);
            if (this.grid && this.grid.children.length > 0) {
                this.calendarRenderer.updateGridContent();
            } else {
                this.calendarRenderer.updateCalendarGrid();
            }
        }
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.toggleClass('streams-bar-expanded-active', this.expanded);
        collapsedView.toggleClass('streams-today-button-expanded', this.expanded);
        
        if (this.expanded && this.calendarRenderer) {
            if (this.grid && this.grid.children.length > 0) {
                const timeoutId = window.setTimeout(() => {
                    this.calendarRenderer!.updateGridContent();
                }, TIMING.SHORT_DELAY);
                this.timeoutIds.push(timeoutId);
            } else {
                const timeoutId = window.setTimeout(() => {
                    this.calendarRenderer!.updateCalendarGrid();
                }, TIMING.SHORT_DELAY);
                this.timeoutIds.push(timeoutId);
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
            const formattedDate = this.dateNavigationService.formatDate(currentDate);
            this.todayButton.setText(formattedDate);
        }
    }

    public destroy() {
        // Clean up event bus subscriptions
        if (this.unsubscribeDateChanged) {
            this.unsubscribeDateChanged();
            this.unsubscribeDateChanged = null;
        }
        
        if (this.unsubscribeActiveStreamChanged) {
            this.unsubscribeActiveStreamChanged();
            this.unsubscribeActiveStreamChanged = null;
        }
        
        if (this.unsubscribeSettingsChanged) {
            this.unsubscribeSettingsChanged();
            this.unsubscribeSettingsChanged = null;
        }
        
        // Clean up extracted handlers
        if (this.touchGestureHandler) {
            this.touchGestureHandler.cleanup();
            this.touchGestureHandler = null;
        }
        
        if (this.documentEventHandler) {
            this.documentEventHandler.cleanup();
            this.documentEventHandler = null;
        }
        
        // Clean up all registered event listeners via registry
        this.eventRegistry.cleanup();
        
        // Clean up setTimeout callbacks
        this.timeoutIds.forEach(id => window.clearTimeout(id));
        this.timeoutIds = [];
        
        // Clean up calendar renderer component
        if (this.calendarRenderer) {
            this.calendarRenderer.onunload();
            this.calendarRenderer = null;
        }
        
        // Clean up stream selector component
        if (this.streamSelector) {
            this.streamSelector.onunload();
            this.streamSelector = null;
        }
        
        // Clean up references
        this.prevButton = null;
        this.nextButton = null;
        this.grid = null;
        
        if (this.component && this.component.parentElement) {
            this.component.remove();
        }
    }

    private async navigateToAdjacentDay(offset: number): Promise<void> {
        await this.dateNavigationService.navigateToAdjacentDay(offset);
    }

    // Stream dropdown methods moved to StreamSelector component
    private toggleStreamsDropdown() {
        if (this.streamSelector) {
            this.streamSelector.toggle();
        }
    }

    private showStreamsDropdown() {
        if (this.streamSelector) {
            this.streamSelector.show();
        }
    }

    private hideStreamsDropdown() {
        if (this.streamSelector) {
            this.streamSelector.hide();
        }
    }

    public setCurrentViewedDate(dateString: string): void {
        this.dateStateManager.setCurrentViewedDate(dateString);
    }

    public updateStreamsList(streams: Stream[]) {
        this.streams = streams;
        if (this.streamSelector) {
            this.streamSelector.updateStreams(streams);
        }
    }

    public refreshStreamsDropdown() {
        if (this.streamSelector) {
            this.streamSelector.populateStreamsDropdown();
        }
    }

    // Date utility methods moved to DateNavigationService
    // Calendar rendering methods moved to CalendarRenderer

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

    private handleDateStateChange(state: DateState): void {
        // Update the today button display
        this.updateTodayButton();
        
        // Update the month view to match the selected date's month
        this.currentMonthView = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
        
        // Update calendar grid if it exists
        if (this.calendarRenderer) {
            this.calendarRenderer.setMonthView(this.currentMonthView);
            if (this.grid && this.grid.children.length > 0) {
                this.calendarRenderer.updateGridContent();
            } else {
                this.calendarRenderer.updateCalendarGrid();
            }
        }
    }

    private handleActiveStreamChange(eventData: { streamId: string }): void {
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
        if (this.changeStreamText) {
            this.changeStreamText.setText(newActiveStream.name);
        }
        
        // Update the encryption icon
        if (this.changeStreamSection) {
            this.updateStreamEncryptionIcon(this.changeStreamSection);
        }
        
        
        // Update content indicator service with new stream
        this.contentIndicatorService = new ContentIndicatorService(this.app, newActiveStream, this.meldDetectionService);
        
        // Update the calendar grid to reflect the new stream's content
        if (this.calendarRenderer) {
            // Update the renderer's content service reference
            this.calendarRenderer.setContentIndicatorService(this.contentIndicatorService);
            this.calendarRenderer.updateGridContent();
        }
        
        // Refresh the streams dropdown to show the correct selection
        if (this.streamSelector) {
            this.streamSelector.updateActiveStreamId(streamId);
        }
    }
    
    private handleSettingsChange(settings: StreamsSettings): void {
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