import { App, setIcon, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../shared/types';
import { SettingsManager, UIController } from '../../shared/interfaces';
import { OpenTodayCurrentStreamCommand } from '../file-operations/OpenTodayCurrentStreamCommand';
import { getSetting } from '../../shared/obsidian-types';
import { CalendarRenderer } from './CalendarRenderer';
import { StreamSelector } from './StreamSelector';
import { ContentIndicatorService } from './ContentIndicatorService';
import { DateNavigationService } from './DateNavigationService';
import { EventHandlerRegistry } from '../../shared/EventHandlerRegistry';
import { TouchGestureHandler } from './TouchGestureHandler';
import { DocumentEventHandler } from './DocumentEventHandler';
import { ComponentStateManager } from './ComponentStateManager';
import { DateStateManager } from '../../shared/DateStateManager';

/**
 * Interface for UI element references that will be set by the builder
 */
export interface UIElements {
    collapsedView: HTMLElement;
    expandedView: HTMLElement;
    changeStreamSection: HTMLElement;
    changeStreamText: HTMLElement;
    dateDisplay: HTMLElement;
    todayButton: HTMLElement;
    prevButton: HTMLElement;
    nextButton: HTMLElement;
    grid: HTMLElement;
    streamsDropdown: HTMLElement;
}

/**
 * Callbacks for component actions
 */
export interface ComponentCallbacks {
    navigateToAdjacentDay: (offset: number) => Promise<void>;
    navigateMonth: (direction: number, dateDisplay: HTMLElement) => void;
    toggleExpanded: () => void;
    toggleStreamsDropdown: () => void;
    hideStreamsDropdown: () => void;
    updateTodayButton: () => void;
    isExpanded: () => boolean;
    onStreamSelected: (stream: Stream) => void;
}

/**
 * Builds the UI structure for StreamsBarComponent
 * Extracted to follow Single Responsibility Principle
 */
export class ComponentUIBuilder {
    private app: App;
    private streams: Stream[];
    private settingsManager: SettingsManager | null;
    private uiController: UIController | null;
    private reuseCurrentTab: boolean;
    private eventRegistry: EventHandlerRegistry;
    private stateManager: ComponentStateManager;
    private dateNavigationService: DateNavigationService;
    private dateStateManager: DateStateManager;
    private contentIndicatorService: ContentIndicatorService;
    private callbacks: ComponentCallbacks;
    private leaf: WorkspaceLeaf;

    constructor(
        app: App,
        streams: Stream[],
        settingsManager: SettingsManager | null,
        uiController: UIController | null,
        reuseCurrentTab: boolean,
        eventRegistry: EventHandlerRegistry,
        stateManager: ComponentStateManager,
        dateNavigationService: DateNavigationService,
        dateStateManager: DateStateManager,
        contentIndicatorService: ContentIndicatorService,
        callbacks: ComponentCallbacks,
        leaf: WorkspaceLeaf
    ) {
        this.app = app;
        this.streams = streams;
        this.settingsManager = settingsManager;
        this.uiController = uiController;
        this.reuseCurrentTab = reuseCurrentTab;
        this.eventRegistry = eventRegistry;
        this.stateManager = stateManager;
        this.dateNavigationService = dateNavigationService;
        this.dateStateManager = dateStateManager;
        this.contentIndicatorService = contentIndicatorService;
        this.callbacks = callbacks;
        this.leaf = leaf;
    }

    /**
     * Build the complete UI structure
     */
    buildUI(component: HTMLElement): {
        elements: UIElements;
        calendarRenderer: CalendarRenderer;
        streamSelector: StreamSelector;
        touchGestureHandler: TouchGestureHandler;
        documentEventHandler: DocumentEventHandler;
        currentMonthView: Date;
    } {
        const collapsedView = component.createDiv('streams-bar-collapsed');
        const expandedView = component.createDiv('streams-bar-expanded');

        this.setupExpandedViewScroll(expandedView);

        const navControls = collapsedView.createDiv('streams-bar-nav-controls');
        const { todayButton, streamSelector, streamsDropdown, changeStreamSection, changeStreamText } =
            this.setupCollapsedView(collapsedView, navControls);

        const { prevButton, nextButton, dateDisplay, grid, calendarRenderer, currentMonthView } =
            this.setupExpandedView(expandedView);

        const touchGestureHandler = this.setupCalendarHandlers(
            expandedView,
            grid,
            prevButton,
            nextButton,
            dateDisplay
        );

        const documentEventHandler = this.setupDocumentHandlers(
            collapsedView,
            expandedView,
            todayButton,
            changeStreamSection,
            streamsDropdown,
            streamSelector
        );

        component.offsetHeight;
        component.addClass('streams-bar-component--visible');

        return {
            elements: {
                collapsedView,
                expandedView,
                changeStreamSection,
                changeStreamText,
                dateDisplay,
                todayButton,
                prevButton,
                nextButton,
                grid,
                streamsDropdown
            },
            calendarRenderer,
            streamSelector,
            touchGestureHandler,
            documentEventHandler,
            currentMonthView
        };
    }

    private setupExpandedViewScroll(expandedView: HTMLElement): void {
        this.eventRegistry.register(expandedView, 'wheel', (e: WheelEvent) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });
    }

    private setupCollapsedView(
        collapsedView: HTMLElement,
        navControls: HTMLElement
    ): {
        todayButton: HTMLElement;
        streamSelector: StreamSelector;
        streamsDropdown: HTMLElement;
        changeStreamSection: HTMLElement;
        changeStreamText: HTMLElement;
    } {
        this.setupNavigationControls(navControls, collapsedView);

        const changeStreamSection = collapsedView.createDiv('streams-bar-change-stream');
        const changeStreamText = changeStreamSection.createDiv('streams-bar-change-stream-text');
        changeStreamText.setText(this.stateManager.getDisplayStreamName());

        this.stateManager.updateStreamEncryptionIcon(changeStreamSection);

        this.eventRegistry.register(changeStreamSection, 'click', (e: Event) => {
            e.stopPropagation();
            if (this.callbacks.isExpanded()) {
                this.callbacks.toggleExpanded();
            }
            this.callbacks.toggleStreamsDropdown();
        });

        const streamsDropdown = changeStreamSection.createDiv('streams-bar-streams-dropdown streams-dropdown streams-bar-dropdown-hidden');

        const streamSelector = new StreamSelector(
            streamsDropdown,
            this.streams,
            this.stateManager.getActiveStreamId(),
            this.app,
            this.settingsManager as any,
            this.reuseCurrentTab,
            this.dateStateManager,
            this.callbacks.onStreamSelected
        );
        streamSelector.populateStreamsDropdown();

        this.eventRegistry.register(streamsDropdown, 'click', (e: Event) => {
            if (this.callbacks.isExpanded()) {
                this.callbacks.toggleExpanded();
            }
        });

        const todayButton = navControls.querySelector('.streams-bar-today-button') as HTMLElement;

        return {
            todayButton: todayButton!,
            streamSelector,
            streamsDropdown,
            changeStreamSection,
            changeStreamText
        };
    }

    private setupNavigationControls(navControls: HTMLElement, collapsedView: HTMLElement): void {
        const prevDayButton = navControls.createDiv('streams-bar-day-nav prev-day');
        prevDayButton.setText('←');
        prevDayButton.setAttribute('aria-label', 'Previous day');
        this.eventRegistry.register(prevDayButton, 'click', async (e: Event) => {
            e.stopPropagation();
            await this.callbacks.navigateToAdjacentDay(-1);
        });

        const todayButton = navControls.createDiv('streams-bar-today-button');

        this.eventRegistry.register(todayButton, 'click', (e: Event) => {
            e.stopPropagation();
            this.callbacks.hideStreamsDropdown();
            this.callbacks.toggleExpanded();
        });

        const nextDayButton = navControls.createDiv('streams-bar-day-nav next-day');
        nextDayButton.setText('→');
        nextDayButton.setAttribute('aria-label', 'Next day');
        this.eventRegistry.register(nextDayButton, 'click', async (e: Event) => {
            e.stopPropagation();
            await this.callbacks.navigateToAdjacentDay(1);
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
            const command = new OpenTodayCurrentStreamCommand(
                this.app,
                this.streams,
                this.reuseCurrentTab,
                (this.settingsManager as any) ?? undefined,
                this.stateManager.getActiveStream(),
                this.leaf,
                this.dateStateManager
            );
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

    private setupExpandedView(expandedView: HTMLElement): {
        prevButton: HTMLElement;
        nextButton: HTMLElement;
        dateDisplay: HTMLElement;
        grid: HTMLElement;
        calendarRenderer: CalendarRenderer;
        currentMonthView: Date;
    } {
        const header = expandedView.createDiv('streams-bar-header');
        const prevButton = header.createDiv('streams-bar-nav');
        prevButton.setText('←');

        const dateDisplay = header.createDiv('streams-bar-date');
        const state = this.dateStateManager.getState();
        const currentMonthView = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
        dateDisplay.setText(this.dateNavigationService.formatMonthYear(currentMonthView));

        const nextButton = header.createDiv('streams-bar-nav');
        nextButton.setText('→');

        const grid = expandedView.createDiv('streams-bar-grid');

        const calendarRenderer = new CalendarRenderer(
            grid,
            this.contentIndicatorService,
            this.dateNavigationService,
            currentMonthView,
            async (day: number, monthView: Date) => {
                await this.dateNavigationService.selectDate(monthView, day);
                if (this.callbacks.isExpanded()) {
                    this.callbacks.toggleExpanded();
                }
            },
            () => { }
        );
        calendarRenderer.updateCalendarGrid();

        return {
            prevButton,
            nextButton,
            dateDisplay,
            grid,
            calendarRenderer,
            currentMonthView
        };
    }

    private setupCalendarHandlers(
        expandedView: HTMLElement,
        grid: HTMLElement | null,
        prevButton: HTMLElement | null,
        nextButton: HTMLElement | null,
        dateDisplay: HTMLElement | null
    ): TouchGestureHandler {
        if (!grid || !prevButton || !nextButton || !dateDisplay) {
            throw new Error('Required elements for calendar handlers are missing');
        }

        const touchGestureHandler = new TouchGestureHandler(
            this.eventRegistry,
            (direction: number) => {
                if (dateDisplay) {
                    this.callbacks.navigateMonth(direction, dateDisplay);
                }
            }
        );

        touchGestureHandler.setupGridScrollHandlers(grid);

        const handlePrevMonth = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            if (dateDisplay) {
                this.callbacks.navigateMonth(-1, dateDisplay);
            }
        };

        const handleNextMonth = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            if (dateDisplay) {
                this.callbacks.navigateMonth(1, dateDisplay);
            }
        };

        this.eventRegistry.register(prevButton, 'click', handlePrevMonth);
        this.eventRegistry.register(nextButton, 'click', handleNextMonth);

        touchGestureHandler.setupTouchNavigationHandlers(prevButton, nextButton, dateDisplay);
        touchGestureHandler.setupWheelNavigationHandlers(prevButton, nextButton);

        return touchGestureHandler;
    }

    private setupDocumentHandlers(
        collapsedView: HTMLElement,
        expandedView: HTMLElement,
        todayButton: HTMLElement,
        changeStreamSection: HTMLElement,
        streamsDropdown: HTMLElement,
        streamSelector: StreamSelector
    ): DocumentEventHandler {
        const documentEventHandler = new DocumentEventHandler(
            this.eventRegistry,
            todayButton,
            changeStreamSection,
            streamsDropdown,
            expandedView,
            streamSelector,
            () => {
                this.callbacks.toggleExpanded();
            },
            () => {
                this.callbacks.hideStreamsDropdown();
            }
        );

        documentEventHandler.setupDocumentHandlers();

        return documentEventHandler;
    }
}

