/**
 * Event Bus for inter-slice communication
 * Allows slices to communicate without tight coupling
 */

import { centralizedLogger } from './centralized-logger';

export interface EventBusEvent {
    type: string;
    data?: any;
    timestamp: number;
    source: string;
}

export type EventHandler = (event: EventBusEvent) => void;

export class EventBus {
    private handlers = new Map<string, Set<EventHandler>>();
    private eventHistory: EventBusEvent[] = [];
    private maxHistorySize = 100;

    /**
     * Subscribe to an event type
     */
    subscribe(eventType: string, handler: EventHandler): () => void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        
        this.handlers.get(eventType)!.add(handler);
        
        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(eventType);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.handlers.delete(eventType);
                }
            }
        };
    }

    /**
     * Emit an event
     */
    emit(eventType: string, data?: any, source: string = 'unknown'): void {
        const event: EventBusEvent = {
            type: eventType,
            data,
            timestamp: Date.now(),
            source
        };

        // Add to history
        this.eventHistory.push(event);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        // Notify handlers
        const handlers = this.handlers.get(eventType);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(event);
                } catch (error) {
                    centralizedLogger.error(`Error in event handler for ${eventType}:`, error);
                }
            });
        }
    }

    /**
     * Get event history
     */
    getHistory(eventType?: string): EventBusEvent[] {
        if (eventType) {
            return this.eventHistory.filter(event => event.type === eventType);
        }
        return [...this.eventHistory];
    }

    /**
     * Clear event history
     */
    clearHistory(): void {
        this.eventHistory = [];
    }

    /**
     * Get all registered event types
     */
    getEventTypes(): string[] {
        return Array.from(this.handlers.keys());
    }

    /**
     * Get handler count for an event type
     */
    getHandlerCount(eventType: string): number {
        return this.handlers.get(eventType)?.size || 0;
    }
}

// Global event bus instance
export const eventBus = new EventBus();

// Event types
export const EVENTS = {
    // Stream events
    STREAM_ADDED: 'stream:added',
    STREAM_UPDATED: 'stream:updated',
    STREAM_REMOVED: 'stream:removed',
    ACTIVE_STREAM_CHANGED: 'stream:active-changed',
    
    // Settings events
    SETTINGS_CHANGED: 'settings:changed',
    
    // UI events
    CALENDAR_COMPONENT_UPDATED: 'ui:calendar-updated',
    RIBBON_ICONS_UPDATED: 'ui:ribbon-updated',
    
    // File events
    FILE_OPENED: 'file:opened',
    FILE_CREATED: 'file:created',
    
    // Plugin events
    PLUGIN_LOADED: 'plugin:loaded',
    PLUGIN_UNLOADED: 'plugin:unloaded',
    
    // Error events
    ERROR_OCCURRED: 'error:occurred'
} as const;
