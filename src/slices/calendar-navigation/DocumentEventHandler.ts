import { EventHandlerRegistry } from '../../shared/event-handler-registry';

/**
 * Handles document-level click events for calendar and dropdown interactions
 * Extracted from StreamsBarComponent to follow Single Responsibility Principle
 */
export class DocumentEventHandler {
    private eventRegistry: EventHandlerRegistry;
    private todayButton: HTMLElement | null;
    private changeStreamSection: HTMLElement | null;
    private streamsDropdown: HTMLElement | null;
    private expandedView: HTMLElement | null;
    private streamSelector: { isVisible: () => boolean; hide: () => void } | null;
    private onToggleExpanded: () => void;
    private onHideDropdown: () => void;
    
    constructor(
        eventRegistry: EventHandlerRegistry,
        todayButton: HTMLElement | null,
        changeStreamSection: HTMLElement | null,
        streamsDropdown: HTMLElement | null,
        expandedView: HTMLElement | null,
        streamSelector: { isVisible: () => boolean; hide: () => void } | null,
        onToggleExpanded: () => void,
        onHideDropdown: () => void
    ) {
        this.eventRegistry = eventRegistry;
        this.todayButton = todayButton;
        this.changeStreamSection = changeStreamSection;
        this.streamsDropdown = streamsDropdown;
        this.expandedView = expandedView;
        this.streamSelector = streamSelector;
        this.onToggleExpanded = onToggleExpanded;
        this.onHideDropdown = onHideDropdown;
    }
    
    /**
     * Create and register the document click handler
     */
    createDocumentClickHandler(): (e: Event) => void {
        return (e: Event) => {
            const target = e.target as Node;
            
            const isCalendarToggle = !!(this.todayButton && (this.todayButton.contains(target) || this.todayButton === target));
            const isDropdownToggle = !!(this.changeStreamSection && (this.changeStreamSection.contains(target) || this.changeStreamSection === target));
            
            const dropdownOpen = !!(this.streamSelector && this.streamSelector.isVisible());
            const calendarOpen = !!(this.expandedView && this.expandedView.classList.contains('streams-bar-expanded-active'));
            
            const isInsideCalendar = !!(this.expandedView && this.expandedView.contains(target));
            const isInsideDropdown = !!(this.streamsDropdown && this.streamsDropdown.contains(target));
            
            // Handle toggle button interactions
            if (this.handleToggleButtonClicks(isCalendarToggle, isDropdownToggle, dropdownOpen, calendarOpen)) {
                return;
            }
            
            // Handle clicks inside calendar/dropdown areas
            if (this.handleAreaClicks(isInsideCalendar, isInsideDropdown, dropdownOpen, calendarOpen)) {
                return;
            }
            
            // Close open menus when clicking outside
            this.closeOpenMenus(calendarOpen, dropdownOpen);
        };
    }
    
    /**
     * Register document-level event handlers
     */
    setupDocumentHandlers(): void {
        const clickHandler = this.createDocumentClickHandler();
        this.eventRegistry.registerDocument('click', clickHandler);

        this.eventRegistry.registerDocument('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.expandedView?.classList.contains('streams-bar-expanded-active')) {
                e.preventDefault();
                e.stopPropagation();
                this.onToggleExpanded();
            }
        });
    }

    private handleToggleButtonClicks(
        isCalendarToggle: boolean,
        isDropdownToggle: boolean,
        dropdownOpen: boolean,
        calendarOpen: boolean
    ): boolean {
        if (isCalendarToggle && dropdownOpen) {
            this.onHideDropdown();
            return true;
        }
        
        if (isDropdownToggle && calendarOpen) {
            this.onToggleExpanded();
            return true;
        }
        
        if (isCalendarToggle || isDropdownToggle) {
            return true; // Let the toggle handle its own state
        }
        
        return false;
    }

    private handleAreaClicks(
        isInsideCalendar: boolean,
        isInsideDropdown: boolean,
        dropdownOpen: boolean,
        calendarOpen: boolean
    ): boolean {
        if (isInsideCalendar && dropdownOpen) {
            this.onHideDropdown();
            return true;
        }
        
        if (isInsideDropdown && calendarOpen) {
            this.onToggleExpanded();
            return true;
        }
        
        return false;
    }

    private closeOpenMenus(
        calendarOpen: boolean,
        dropdownOpen: boolean
    ): void {
        if (calendarOpen) {
            this.onToggleExpanded();
        }
        
        if (dropdownOpen) {
            this.onHideDropdown();
        }
    }

    /**
     * Update references (called when UI elements change)
     */
    updateReferences(
        todayButton: HTMLElement | null,
        changeStreamSection: HTMLElement | null,
        streamsDropdown: HTMLElement | null,
        expandedView: HTMLElement | null,
        streamSelector: { isVisible: () => boolean; hide: () => void } | null
    ): void {
        this.todayButton = todayButton;
        this.changeStreamSection = changeStreamSection;
        this.streamsDropdown = streamsDropdown;
        this.expandedView = expandedView;
        this.streamSelector = streamSelector;
    }

    /**
     * Cleanup all registered event handlers
     */
    cleanup(): void {
        this.eventRegistry.cleanup();
    }
}

