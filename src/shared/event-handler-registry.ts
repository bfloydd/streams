/**
 * Event Handler Registry for automatic event listener cleanup
 * Reduces manual cleanup code and prevents memory leaks
 */

/**
 * Registry for managing event listeners with automatic cleanup
 */
export class EventHandlerRegistry {
    private handlers: Array<() => void> = [];
    
    /**
     * Register an event listener with automatic cleanup
     * @param element - The element to attach the listener to
     * @param event - The event type (e.g., 'click', 'touchstart')
     * @param handler - The event handler function
     * @param options - Optional AddEventListenerOptions
     * @returns The original handler function for reference
     */
    register<T extends Event>(
        element: EventTarget,
        event: string,
        handler: (event: T) => void,
        options?: boolean | AddEventListenerOptions
    ): (event: T) => void {
        const listener = handler as EventListener;
        element.addEventListener(event, listener, options);
        
        // Store cleanup function
        this.handlers.push(() => {
            element.removeEventListener(event, listener, options);
        });
        
        return handler;
    }
    
    /**
     * Register a document event listener
     * @param event - The event type
     * @param handler - The event handler function
     * @param options - Optional AddEventListenerOptions
     * @returns The original handler function for reference
     */
    registerDocument<T extends Event>(
        event: string,
        handler: (event: T) => void,
        options?: boolean | AddEventListenerOptions
    ): (event: T) => void {
        return this.register(document, event, handler, options);
    }
    
    /**
     * Register a window event listener
     * @param event - The event type
     * @param handler - The event handler function
     * @param options - Optional AddEventListenerOptions
     * @returns The original handler function for reference
     */
    registerWindow<T extends Event>(
        event: string,
        handler: (event: T) => void,
        options?: boolean | AddEventListenerOptions
    ): (event: T) => void {
        return this.register(window, event, handler, options);
    }
    
    /**
     * Register a cleanup function to be called when cleanup() is invoked
     * Useful for custom cleanup logic (e.g., unsubscribing from observables)
     * @param cleanupFn - Function to call during cleanup
     */
    registerCleanup(cleanupFn: () => void): void {
        this.handlers.push(cleanupFn);
    }
    
    /**
     * Clean up all registered event listeners and cleanup functions
     */
    cleanup(): void {
        this.handlers.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                console.error('Error during event handler cleanup:', error);
            }
        });
        this.handlers = [];
    }
    
    /**
     * Get the number of registered handlers
     */
    getHandlerCount(): number {
        return this.handlers.length;
    }
    
    /**
     * Check if registry has any handlers
     */
    hasHandlers(): boolean {
        return this.handlers.length > 0;
    }
}

