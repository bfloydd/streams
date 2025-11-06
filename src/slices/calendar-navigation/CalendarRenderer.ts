import { Component, setIcon } from 'obsidian';
import { DateStateManager } from '../../shared/date-state-manager';
import { performanceMonitor } from '../../shared/performance-monitor';
import { ContentIndicator, ContentIndicatorService } from './ContentIndicatorService';
import { DateNavigationService } from './DateNavigationService';
import { TIMING } from '../../shared/timing-constants';
import { EventHandlerRegistry } from '../../shared/event-handler-registry';

/**
 * Component responsible for rendering the calendar grid
 * Handles calendar display, day rendering, and content indicators
 */
export class CalendarRenderer extends Component {
    private grid: HTMLElement;
    private contentIndicatorService: ContentIndicatorService;
    private dateNavigationService: DateNavigationService;
    private dateStateManager: DateStateManager;
    private currentMonthView: Date;
    private onDateSelected: (day: number) => Promise<void>;
    private onDropdownClose?: () => void;
    private eventRegistry: EventHandlerRegistry;

    constructor(
        grid: HTMLElement,
        contentIndicatorService: ContentIndicatorService,
        dateNavigationService: DateNavigationService,
        currentMonthView: Date,
        onDateSelected: (day: number) => Promise<void>,
        onDropdownClose?: () => void
    ) {
        super();
        this.grid = grid;
        this.contentIndicatorService = contentIndicatorService;
        this.dateNavigationService = dateNavigationService;
        this.currentMonthView = currentMonthView;
        this.onDateSelected = onDateSelected;
        this.onDropdownClose = onDropdownClose;
        this.dateStateManager = DateStateManager.getInstance();
        this.eventRegistry = new EventHandlerRegistry();
    }

    /**
     * Update the calendar grid with the current month
     */
    async updateCalendarGrid(): Promise<void> {
        const endTiming = performanceMonitor.startTiming('calendar-grid-update');
        
        try {
            if (this.grid.children.length > 0) {
                await this.updateGridContent();
                return;
            }
            
            // Use DocumentFragment for batch DOM operations
            const fragment = document.createDocumentFragment();
        
            const state = this.dateStateManager.getState();
            const currentDate = this.currentMonthView;
            const daysInMonth = this.dateNavigationService.getDaysInMonth(
                currentDate.getFullYear(), 
                currentDate.getMonth()
            );
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
                contentPromises.push(this.contentIndicatorService.getContentIndicator(dayDate));
            }
            
            // Clear grid and append all elements at once
            this.grid.empty();
            this.grid.appendChild(fragment);
            
            // Process content indicators and apply styles in batch
            const contentIndicators = await Promise.all(contentPromises);
            
            // Batch apply styles and content
            this.applyDayStylesAndContent(dayElements, contentIndicators, currentDate, state);
            
            // Use event delegation for better performance
            this.setupCalendarEventDelegation();
            
        } finally {
            endTiming();
        }
    }
    
    /**
     * Update existing calendar grid content
     */
    async updateGridContent(): Promise<void> {
        const endTiming = performanceMonitor.startTiming('calendar-grid-content-update');
        
        try {
            const dayElements = Array.from(this.grid.querySelectorAll('.streams-bar-day:not(.empty)')) as HTMLElement[];
            const state = this.dateStateManager.getState();
            const currentDate = this.currentMonthView;
            
            // Batch prepare all content indicators
            const contentPromises = dayElements.map((dayEl, i) => {
                const day = i + 1;
                const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                return this.contentIndicatorService.getContentIndicator(dayDate);
            });
            
            // Wait for all content indicators to load
            const contentIndicators = await Promise.all(contentPromises);
            
            // Batch apply all updates
            this.applyDayStylesAndContent(dayElements, contentIndicators, currentDate, state);
        } finally {
            endTiming();
        }
    }

    /**
     * Update the month view
     */
    setMonthView(monthView: Date): void {
        this.currentMonthView = monthView;
    }

    /**
     * Update the content indicator service (e.g., when stream changes)
     */
    setContentIndicatorService(service: ContentIndicatorService): void {
        this.contentIndicatorService = service;
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
                const dateString = this.dateNavigationService.formatDateString(dayDate);
                
                // Get dot container once
                const dotContainer = dayEl.querySelector('.streams-dot-container') as HTMLElement;
                
                // Clear existing dots
                if (dotContainer) {
                    while (dotContainer.firstChild) {
                        dotContainer.removeChild(dotContainer.firstChild);
                    }
                }
                
                // Apply classes efficiently
                const classList = dayEl.classList;
                classList.remove('viewed', 'today');
                
                if (dateString === state.currentViewedDate) {
                    classList.add('viewed');
                }
                
                if (this.dateNavigationService.isToday(dayDate)) {
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
    private setupCalendarEventDelegation(): void {
        // Create single event handler for all day clicks
        const calendarClickHandler = (e: Event) => {
            const target = e.target as HTMLElement;
            
            // Close dropdown if it's open when clicking anywhere in calendar
            if (this.onDropdownClose) {
                this.onDropdownClose();
            }
            
            const dayEl = target.closest('.streams-bar-day:not(.empty)') as HTMLElement;
            
            if (dayEl) {
                e.preventDefault();
                e.stopPropagation();
                
                const day = parseInt(dayEl.getAttribute('data-day') || '0', 10);
                if (day > 0) {
                    this.onDateSelected(day);
                }
            }
        };
        
        // Register event listeners using EventHandlerRegistry for automatic cleanup
        this.eventRegistry.register(this.grid, 'click', calendarClickHandler);
        this.eventRegistry.register(this.grid, 'touchend', calendarClickHandler, { passive: true } as AddEventListenerOptions);
    }

    onunload(): void {
        // Clean up all registered event listeners
        this.eventRegistry.cleanup();
    }
}

