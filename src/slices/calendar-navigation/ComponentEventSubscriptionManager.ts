import { DateStateManager } from '../../shared/date-state-manager';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { DateState } from '../../shared/date-state-manager';
import { StreamsSettings } from '../../shared/types';

/**
 * Manages event subscriptions for StreamsBarComponent
 * Extracted to follow Single Responsibility Principle
 */
export class ComponentEventSubscriptionManager {
    private unsubscribeDateChanged: (() => void) | null = null;
    private unsubscribeActiveStreamChanged: (() => void) | null = null;
    private unsubscribeSettingsChanged: (() => void) | null = null;
    private dateStateManager: DateStateManager;

    constructor(dateStateManager: DateStateManager) {
        this.dateStateManager = dateStateManager;
    }

    /**
     * Subscribe to date state changes
     * @param callback Function to call when date state changes
     * @returns Unsubscribe function
     */
    subscribeToDateChanges(callback: (state: DateState) => void): () => void {
        this.unsubscribeDateChanged = this.dateStateManager.onDateChanged(callback);
        return () => {
            if (this.unsubscribeDateChanged) {
                this.unsubscribeDateChanged();
            }
        };
    }

    /**
     * Subscribe to active stream changes
     * @param callback Function to call when active stream changes
     * @returns Unsubscribe function
     */
    subscribeToActiveStreamChanges(callback: (data: { streamId: string }) => void): () => void {
        this.unsubscribeActiveStreamChanged = eventBus.subscribe(EVENTS.ACTIVE_STREAM_CHANGED, (event) => {
            callback(event.data);
        });
        return () => {
            if (this.unsubscribeActiveStreamChanged) {
                this.unsubscribeActiveStreamChanged();
            }
        };
    }

    /**
     * Subscribe to settings changes
     * @param callback Function to call when settings change
     * @returns Unsubscribe function
     */
    subscribeToSettingsChanges(callback: (settings: StreamsSettings) => void): () => void {
        this.unsubscribeSettingsChanged = eventBus.subscribe(EVENTS.SETTINGS_CHANGED, (event) => {
            callback(event.data);
        });
        return () => {
            if (this.unsubscribeSettingsChanged) {
                this.unsubscribeSettingsChanged();
            }
        };
    }

    /**
     * Clean up all event subscriptions
     */
    cleanup(): void {
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
    }
}

