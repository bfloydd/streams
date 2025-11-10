import { App, WorkspaceLeaf, TFile, MarkdownView, Component, Plugin } from 'obsidian';
import { Stream, StreamsSettings } from '../../shared/types';
import { DateState } from '../../shared/DateStateManager';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { StreamsPluginInterface } from '../../shared/interfaces';
import { CREATE_FILE_VIEW_TYPE } from '../file-operations/CreateFileView';
import { DateStateManager } from '../../shared/DateStateManager';
import { MeldDetectionService } from '../meld-integration';
import { configurationService } from '../../shared/ConfigurationService';
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
        activeStreamId?: string;
        barStyle?: 'default' | 'modern';
    };
    saveSettings(): void;
    setActiveStream(streamId: string, force?: boolean): Promise<void>;
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

    public updateReuseCurrentTab(reuseCurrentTab: boolean): void {
        this.reuseCurrentTab = reuseCurrentTab;
    }

    constructor(leaf: WorkspaceLeaf, stream: Stream, app: App, reuseCurrentTab = false, streams: Stream[] = [], plugin: PluginInterface | null = null) {
        super();
        
        this.leaf = leaf;

        this.selectedStream = stream;
        this.app = app;
        this.reuseCurrentTab = reuseCurrentTab;
        this.streams = streams;
        this.plugin = plugin;
        this.dateStateManager = DateStateManager.getInstance();
        
        this.meldDetectionService = new MeldDetectionService();
        if (plugin) {
            this.meldDetectionService.setPlugin(plugin as unknown as Plugin);
            this.meldDetectionService.initialize().catch(error => {
                centralizedLogger.error('Error initializing MeldDetectionService:', error);
            });
        }
        
        this.contentIndicatorService = new ContentIndicatorService(app, stream, this.meldDetectionService);
        this.dateNavigationService = new DateNavigationService(app, stream, reuseCurrentTab);
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
        
        this.eventSubscriptionManager.subscribeToActiveStreamChanges((data) => {
            this.handleActiveStreamChange(data);
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

        this.initializeComponent();
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
            callbacks
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
        const state = this.dateStateManager.getState();
        const currentDate = state.currentDate;
        const buttonText = this.stateManager.formatTodayButtonText(currentDate);
        this.todayButton.setText(buttonText);
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
            const state = this.dateStateManager.getState();
            this.dateStateManager.setCurrentDate(state.currentDate);
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

    private handleActiveStreamChange(eventData: { streamId: string }): void {
        const { streamId } = eventData;
        
        if (!streamId) {
            return;
        }
        
        const newActiveStream = this.streams.find(s => s.id === streamId);
        if (!newActiveStream) {
            centralizedLogger.warn(`Active stream changed to unknown stream ID: ${streamId}`);
            return;
        }
        
        this.selectedStream = newActiveStream;
        this.stateManager.updateSelectedStream(newActiveStream);
        
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
            this.streamSelector.updateActiveStreamId(streamId);
        }
    }
    
    private handleSettingsChange(settings: StreamsSettings): void {
        this.stateManager.applyBarStyle(this.component);
        
        if (settings.streams) {
            this.streams = settings.streams;
            this.stateManager.updateStreams(settings.streams);
            this.refreshStreamsDropdown();
        }
    }
    
    public refreshBarStyle(): void {
        this.stateManager.applyBarStyle(this.component);
    }

} 
