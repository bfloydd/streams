import { EventHandlerRegistry } from '../../shared/EventHandlerRegistry';
import { configurationService } from '../../shared/ConfigurationService';

/**
 * Handles touch and wheel gestures for calendar navigation
 * Extracted from StreamsBarComponent to follow Single Responsibility Principle
 */
export class TouchGestureHandler {
    private eventRegistry: EventHandlerRegistry;
    private lastTouchX: number | null = null;
    private lastTouchY: number | null = null;
    private onMonthNavigate: (direction: number) => void;
    private dateDisplay: HTMLElement | null = null;
    
    constructor(
        eventRegistry: EventHandlerRegistry,
        onMonthNavigate: (direction: number) => void
    ) {
        this.eventRegistry = eventRegistry;
        this.onMonthNavigate = onMonthNavigate;
    }
    
    /**
     * Setup scroll handlers for the calendar grid
     * Prevents horizontal scroll from interfering with navigation
     */
    setupGridScrollHandlers(grid: HTMLElement): void {
        const gridWheelHandler = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        this.eventRegistry.register(grid, 'wheel', gridWheelHandler, { passive: false });

        const gridTouchMoveHandler = (e: TouchEvent) => {
            const touch = e.touches[0];
            if (touch) {
                const deltaX = Math.abs(touch.clientX - (this.lastTouchX || touch.clientX));
                const deltaY = Math.abs(touch.clientY - (this.lastTouchY || touch.clientY));
                
                if (deltaX > deltaY && deltaX > configurationService.getTimingConfig().TOUCH_DELTA_THRESHOLD) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        this.eventRegistry.register(grid, 'touchmove', gridTouchMoveHandler, { passive: false });

        const gridTouchStartHandler = (e: TouchEvent) => {
            const touch = e.touches[0];
            if (touch) {
                this.lastTouchX = touch.clientX;
                this.lastTouchY = touch.clientY;
            }
        };
        this.eventRegistry.register(grid, 'touchstart', gridTouchStartHandler, { passive: true });
    }

    /**
     * Setup touch navigation handlers for month navigation buttons
     */
    setupTouchNavigationHandlers(
        prevButton: HTMLElement,
        nextButton: HTMLElement,
        dateDisplay: HTMLElement
    ): void {
        this.dateDisplay = dateDisplay;
        
        const prevButtonTouchHandler = (e: TouchEvent) => {
            e.preventDefault();
            const handleTouchEnd = (e: TouchEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.onMonthNavigate(-1);
            };
            this.eventRegistry.register(prevButton, 'touchend', handleTouchEnd, { passive: false, once: true });
        };
        this.eventRegistry.register(prevButton, 'touchstart', prevButtonTouchHandler, { passive: false });

        const nextButtonTouchHandler = (e: TouchEvent) => {
            e.preventDefault();
            const handleTouchEnd = (e: TouchEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.onMonthNavigate(1);
            };
            this.eventRegistry.register(nextButton, 'touchend', handleTouchEnd, { passive: false, once: true });
        };
        this.eventRegistry.register(nextButton, 'touchstart', nextButtonTouchHandler, { passive: false });
    }

    /**
     * Setup wheel navigation handlers for month navigation buttons
     * Prevents wheel events from scrolling when over navigation buttons
     */
    setupWheelNavigationHandlers(
        prevButton: HTMLElement,
        nextButton: HTMLElement
    ): void {
        const prevButtonWheelHandler = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        this.eventRegistry.register(prevButton, 'wheel', prevButtonWheelHandler, { passive: false });

        const nextButtonWheelHandler = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };
        this.eventRegistry.register(nextButton, 'wheel', nextButtonWheelHandler, { passive: false });
    }

    /**
     * Cleanup all registered event handlers
     */
    cleanup(): void {
        this.eventRegistry.cleanup();
        this.lastTouchX = null;
        this.lastTouchY = null;
        this.dateDisplay = null;
    }
}

