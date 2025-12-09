import { App, WorkspaceLeaf, TFile, MarkdownView, Component, Plugin } from 'obsidian';
import { Stream, StreamsSettings } from '../../shared/types';
import { DateState, DateStateManager } from '../../shared/DateStateManager';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { StreamsPluginInterface } from '../../shared/interfaces';
import { CREATE_FILE_VIEW_TYPE } from '../file-operations/CreateFileView';
import { MeldDetectionService } from '../meld-integration';
import { configurationService } from '../../shared/ConfigurationService';
import { StreamContextService } from '../../shared/StreamContextService';
import { CalendarRenderer } from './CalendarRenderer';
import { StreamSelector } from './StreamSelector';
import { ContentIndicatorService } from './ContentIndicatorService';
import { DateNavigationService } from './DateNavigationService';
import { EventHandlerRegistry } from '../../shared/EventHandlerRegistry';
import { TouchGestureHandler } from './TouchGestureHandler';
import { DocumentEventHandler } from './DocumentEventHandler';
import { ViewContainerService } from './ViewContainerService';
import { ComponentEventSubscriptionManager } from './ComponentEventSubscriptionManager';
import { ComponentStateManager } from './ComponentStateManager';
import { ComponentUIBuilder, ComponentCallbacks } from './ComponentUIBuilder';

interface PluginInterface {
    settings: {
        barStyle?: 'default' | 'modern';
    };
    saveSettings(): void;
    setActiveStream(streamId: string, force?: boolean, suppressEvent?: boolean): Promise<void>;
}

export class StreamsBarComponent extends Component {
    private component: HTMLElement;
    private expanded = false;
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
    private contentIndicatorService: ContentIndicatorService;
    private dateNavigationService: DateNavigationService;
    private calendarRenderer: CalendarRenderer | null = null;
    private streamSelector: StreamSelector | null = null;
    private eventRegistry: EventHandlerRegistry;
    private viewContainerService: ViewContainerService;
    private eventSubscriptionManager: ComponentEventSubscriptionManager;
    private stateManager: ComponentStateManager;
    private touchGestureHandler: TouchGestureHandler | null = null;
    private documentEventHandler: DocumentEventHandler | null = null;
    private currentMonthView: Date;
    private timeoutIds: number[] = [];
    private collapsedView: HTMLElement | null = null;
    private expandedView: HTMLElement | null = null;
    private changeStreamSection: HTMLElement | null = null;
    private changeStreamText: HTMLElement | null = null;
    private dateDisplay: HTMLElement | null = null;
    private prevButton: HTMLElement | null = null;
    private nextButton: HTMLElement | null = null;

    private streamContextService: StreamContextService;

    public get activeStreamId(): string {
        return this.selectedStream?.id || '';
    }

    public updateReuseCurrentTab(reuseCurrentTab: boolean): void {
        this.reuseCurrentTab = reuseCurrentTab;
    }

    constructor(leaf: WorkspaceLeaf, stream: Stream, app: App, reuseCurrentTab = false, streams: Stream[] = [], plugin: PluginInterface | null = null) {
        super();

        this.leaf = leaf;

        // this.selectedStream = stream; // Now derived from context
        this.app = app;
        this.reuseCurrentTab = reuseCurrentTab;
        this.streams = streams;
        this.plugin = plugin;
        this.streamContextService = new StreamContextService(); // Instantiate service
        this.dateStateManager = new DateStateManager();

        this.meldDetectionService = new MeldDetectionService();
        if (plugin) {
            this.meldDetectionService.setPlugin(plugin as unknown as Plugin);
            this.meldDetectionService.initialize().catch(error => {
                centralizedLogger.error('Error initializing MeldDetectionService:', error);
            });
        }

        // Initialize with default or passed stream, but immediately verify context
        this.selectedStream = stream;

        this.contentIndicatorService = new ContentIndicatorService(app, stream, this.meldDetectionService);
        this.dateNavigationService = new DateNavigationService(app, stream, reuseCurrentTab, this.dateStateManager, this.leaf);
        this.eventRegistry = new EventHandlerRegistry();
        this.viewContainerService = new ViewContainerService();
        this.eventSubscriptionManager = new ComponentEventSubscriptionManager(this.dateStateManager);
        this.stateManager = new ComponentStateManager(plugin, streams, stream, this.dateNavigationService);
        this.currentMonthView = new Date();

        this.component = document.createElement('div');
        this.component.addClass('streams-bar-component');
        this.stateManager.applyBarStyle(this.component);
        this.initializeDateState(leaf);

        this.eventSubscriptionManager.subscribeToDateChanges((state) => {
            this.handleDateStateChange(state);
        });

        this.eventSubscriptionManager.subscribeToSettingsChanges((settings) => {
            this.handleSettingsChange(settings);
        });

        const contentContainer = this.viewContainerService.findContentContainer(leaf);
        if (!contentContainer) {
            centralizedLogger.error('Could not find content container');
            return;
        }

        this.viewContainerService.removeExistingComponents(leaf, '.streams-bar-component');

        if (!this.viewContainerService.attachComponent(this.component, leaf, contentContainer)) {
            return;
        }

        this.fileModifyHandler = this.handleFileModify.bind(this);
        this.registerEvent(this.app.vault.on('modify', this.fileModifyHandler));

        this.registerEvent(this.app.workspace.on('file-open', (file) => {
            // console.log(`[StreamsBarComponent] file-open event: ${file?.path}`); // Remove debug logs after fix? Or keep for verification? I'll comment them out for now to reduce noise if it works.

            if (this.leaf.view instanceof MarkdownView && this.leaf.view.file === file) {
                // console.log(`[StreamsBarComponent] MarkdownView match. Updating context.`);
                this.updateStreamContext(file);
            } else {
                // Handle Custom Views (CreateFileView, InstallMeldView, etc.)
                const viewType = this.leaf.view.getViewType();
                // console.log(`[StreamsBarComponent] Checking custom view type: ${viewType}`);

                if (viewType === CREATE_FILE_VIEW_TYPE || viewType === 'streams-create-file-view-encrypted') {
                    const view = this.leaf.view as any;
                    if (view.getState) {
                        const state = view.getState();
                        if (state && state.stream) {
                            // console.log(`[StreamsBarComponent] Custom view stream found: ${state.stream.name}`);
                            this.updateActiveStream(state.stream);
                            this.component.show();
                        }
                    }
                }
            }
        }));

        // Initialize component UI first so elements exist
        this.initializeComponent();

        // Initial context check
        const viewType = this.leaf.view.getViewType();
        if (this.leaf.view instanceof MarkdownView) {
            this.updateStreamContext(this.leaf.view.file);
        } else if (viewType === CREATE_FILE_VIEW_TYPE || viewType === 'streams-create-file-view-encrypted') {
            const view = this.leaf.view as any;
            if (view.getState) {
                const state = view.getState();
                if (state && state.stream) {
                    this.updateActiveStream(state.stream);
                    this.component.show(); // Ensure we show it if we have a stream
                }
            }
        }

        this.updateTodayButton();

        // Ensure initial visibility state is correct
        if (this.leaf.view instanceof MarkdownView) {
            this.updateStreamContext(this.leaf.view.file);
        }
    }

    private updateStreamContext(file: TFile | null): void {
        const stream = this.streamContextService.getStreamForFile(file, this.streams);

        if (stream) {
            if (this.selectedStream?.id !== stream.id) {
                this.updateActiveStream(stream);
            }
            this.component.show();
        } else {
            // If no stream found for file, hide the component
            this.component.hide();
        }
    }

    private createUIBuilderCallbacks(): ComponentCallbacks {
        return {
            navigateToAdjacentDay: async (offset: number) => {
                await this.navigateToAdjacentDay(offset);
            },
            navigateMonth: (direction: number, dateDisplay: HTMLElement) => {
                this.navigateMonth(direction, dateDisplay);
            },
            toggleExpanded: () => {
                if (this.collapsedView && this.expandedView) {
                    this.toggleExpanded(this.collapsedView, this.expandedView);
                }
            },
            toggleStreamsDropdown: () => {
                this.toggleStreamsDropdown();
            },
            hideStreamsDropdown: () => {
                this.hideStreamsDropdown();
            },
            updateTodayButton: () => {
                this.updateTodayButton();
            },
            isExpanded: () => {
                return this.expanded;
            },
            onStreamSelected: (stream: Stream) => {
                this.handleStreamSwitch(stream);
            }
        };
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
        const callbacks = this.createUIBuilderCallbacks();

        const uiBuilder = new ComponentUIBuilder(
            this.app,
            this.streams,
            this.plugin as any, // settingsManager
            null, // uiController - not needed for this component
            this.reuseCurrentTab,
            this.eventRegistry,
            this.stateManager,
            this.dateNavigationService,
            this.dateStateManager,
            this.contentIndicatorService,
            callbacks,
            this.leaf
        );

        const uiResult = uiBuilder.buildUI(this.component);

        this.collapsedView = uiResult.elements.collapsedView;
        this.expandedView = uiResult.elements.expandedView;
        this.changeStreamSection = uiResult.elements.changeStreamSection;
        this.changeStreamText = uiResult.elements.changeStreamText;
        this.dateDisplay = uiResult.elements.dateDisplay;
        this.todayButton = uiResult.elements.todayButton;
        this.prevButton = uiResult.elements.prevButton;
        this.nextButton = uiResult.elements.nextButton;
        this.grid = uiResult.elements.grid;
        this.streamsDropdown = uiResult.elements.streamsDropdown;

        this.calendarRenderer = uiResult.calendarRenderer;
        this.streamSelector = uiResult.streamSelector;
        this.touchGestureHandler = uiResult.touchGestureHandler;
        this.documentEventHandler = uiResult.documentEventHandler;
        this.currentMonthView = uiResult.currentMonthView;
    }

    private navigateMonth(direction: number, dateDisplay: HTMLElement): void {
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
                }, configurationService.getTimingConfig().SHORT_DELAY);
                this.timeoutIds.push(timeoutId);
            } else {
                const timeoutId = window.setTimeout(() => {
                    this.calendarRenderer!.updateCalendarGrid();
                }, configurationService.getTimingConfig().SHORT_DELAY);
                this.timeoutIds.push(timeoutId);
            }
        }
    }

    private updateTodayButton() {
        this.refreshStreamFromGlobal();
        if (!this.todayButton) return;

        // Check if current file is in stream
        const view = this.leaf.view;
        let isInStream = true;

        if (view instanceof MarkdownView && view.file) {
            const streamPath = this.selectedStream.folder.split(/[/\\]/).filter(Boolean);
            const filePath = view.file.path.split(/[/\\]/).filter(Boolean);

            if (filePath.length >= streamPath.length) {
                isInStream = streamPath.every((part, index) => streamPath[index] === filePath[index]);
            } else {
                isInStream = false;
            }
        }

        if (!isInStream) {
            this.todayButton.setText('∞');
            this.todayButton.addClass('streams-infinity-mode');
            return;
        }

        const state = this.dateStateManager.getState();
        const currentDate = state.currentDate;
        const buttonText = this.stateManager.formatTodayButtonText(currentDate);
        this.todayButton.setText(buttonText);
        this.todayButton.removeClass('streams-infinity-mode');
    }

    public destroy() {
        this.eventSubscriptionManager.cleanup();

        if (this.touchGestureHandler) {
            this.touchGestureHandler.cleanup();
            this.touchGestureHandler = null;
        }

        if (this.documentEventHandler) {
            this.documentEventHandler.cleanup();
            this.documentEventHandler = null;
        }

        this.eventRegistry.cleanup();
        this.timeoutIds.forEach(id => window.clearTimeout(id));
        this.timeoutIds = [];

        if (this.calendarRenderer) {
            this.calendarRenderer.onunload();
            this.calendarRenderer = null;
        }

        if (this.streamSelector) {
            this.streamSelector.onunload();
            this.streamSelector = null;
        }

        this.prevButton = null;
        this.nextButton = null;
        this.grid = null;

        if (this.component && this.component.parentElement) {
            this.component.remove();
        }
    }

    private async navigateToAdjacentDay(offset: number): Promise<void> {
        this.refreshStreamFromGlobal();
        await this.dateNavigationService.navigateToAdjacentDay(offset);
    }

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
            // We need to cast to any or import CreateFileView to access getState
            // Since we can't easily import CreateFileView here due to circular deps, we'll use any
            const view = leaf.view as any;
            if (view.getState) {
                const state = view.getState();
                if (state && state.date) {
                    const date = new Date(state.date);
                    if (!isNaN(date.getTime())) {
                        this.dateStateManager.setCurrentDate(date);
                    }
                }
            }
        }
    }

    private handleDateStateChange(state: DateState): void {
        this.updateTodayButton();
        this.currentMonthView = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);

        if (this.calendarRenderer) {
            this.calendarRenderer.setMonthView(this.currentMonthView);
            if (this.grid && this.grid.children.length > 0) {
                this.calendarRenderer.updateGridContent();
            } else {
                this.calendarRenderer.updateCalendarGrid();
            }
        }
    }



    public updateActiveStream(newActiveStream: Stream): void {
        this.selectedStream = newActiveStream;
        this.stateManager.updateSelectedStream(newActiveStream);
        this.dateNavigationService.updateStream(newActiveStream);

        if (this.changeStreamText) {
            this.changeStreamText.setText(this.stateManager.getDisplayStreamName());
        }

        if (this.changeStreamSection) {
            this.stateManager.updateStreamEncryptionIcon(this.changeStreamSection);
        }

        this.contentIndicatorService = new ContentIndicatorService(this.app, newActiveStream, this.meldDetectionService);

        if (this.calendarRenderer) {
            this.calendarRenderer.setContentIndicatorService(this.contentIndicatorService);
            this.calendarRenderer.updateGridContent();
        }

        if (this.streamSelector) {
            this.streamSelector.updateActiveStreamId(newActiveStream.id);
        }

        this.updateTodayButton();
    }

    /**
     * Handle explicit stream switch by user (navigates context)
     */
    public handleStreamSwitch(newStream: Stream): void {
        // First update the UI/internal component state
        this.updateActiveStream(newStream);

        // Then trigger navigation/update for the current view
        const view = this.leaf.view;
        const currentDate = this.dateStateManager.getState().currentDate;
        const viewType = view.getViewType();

        if (viewType === CREATE_FILE_VIEW_TYPE || viewType === 'streams-create-file-view-encrypted') {
            // For CreateFileView, update state in place
            const viewAny = view as any;
            if (viewAny.setState) {
                viewAny.setState({ stream: newStream, date: currentDate });
            }
        } else if (view instanceof MarkdownView) {
            // For MarkdownView, navigate to the corresponding date in the new stream
            this.dateNavigationService.navigateToDate(currentDate);
        }
    }

    /**
     * Helper to force refresh the current stream from global source of truth
     */
    private refreshStreamFromGlobal(): void {
        const plugins = (this.app as any).plugins?.plugins;
        const plugin = plugins?.['streams'] as any;

        if (plugin) {
            // Try to get fresh streams list via public API first, then active settings
            const allStreams = plugin.getStreams ? plugin.getStreams() : plugin.settings?.streams;

            if (allStreams && Array.isArray(allStreams)) {
                const currentId = this.selectedStream?.id;
                const freshStream = allStreams.find((s: Stream) => s.id === currentId);

                if (freshStream) {
                    // Check if data is actually different to avoid loops/noise
                    if (JSON.stringify(freshStream) !== JSON.stringify(this.selectedStream)) {
                        console.log(`[StreamsBarComponent] Force refreshed stream data. Old folder: ${this.selectedStream.folder}, New folder: ${freshStream.folder}`);
                        this.updateActiveStream(freshStream);
                    }
                }
            }
        }
    }

    private handleSettingsChange(settings: StreamsSettings): void {
        this.stateManager.applyBarStyle(this.component);

        if (settings.streams) {
            // Update streams list in selector
            this.updateStreamsList(settings.streams);

            // If current stream exists in new settings, update it to ensure we have latest properties (like folder)
            if (this.selectedStream) {
                const updatedStream = settings.streams.find(s => s.id === this.selectedStream.id);
                if (updatedStream) {
                    console.log(`[StreamsBarComponent] Updating active stream from settings. New folder: ${updatedStream.folder}, Old: ${this.selectedStream.folder}`);
                    this.handleStreamSwitch(updatedStream);
                } else {
                    console.warn(`[StreamsBarComponent] Current stream ${this.selectedStream.id} not found in new settings.`);
                }
            }
        }
    }

    public refreshBarStyle(): void {
        this.stateManager.applyBarStyle(this.component);
    }

} 
