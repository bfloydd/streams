import { DateStateManager } from '../../shared/DateStateManager';
import { eventBus, EVENTS } from '../../shared/EventBus';
import { DateState } from '../../shared/DateStateManager';
import { StreamsSettings } from '../../shared/types';

/**
 * Manages event subscriptions for StreamsBarComponent
 * Extracted to follow Single Responsibility Principle
 */
export class ComponentEventSubscriptionManager {
    private unsubscribeDateChanged: (() => void) | null = null;

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



        if (this.unsubscribeSettingsChanged) {
            this.unsubscribeSettingsChanged();
            this.unsubscribeSettingsChanged = null;
        }
    }
}

