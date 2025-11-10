import { App } from 'obsidian';
import { BaseSliceService } from '../../shared/BaseSlice';
import { EventHandlerService } from './EventHandlerService';
import { ComponentLifecycleManager } from './ComponentLifecycleManager';
import { LeafInspectionService } from './LeafInspectionService';

/**
 * Coordinator for event handling functionality
 * Manages the registration and coordination of event handlers
 */
export class EventCoordinator extends BaseSliceService {
    private eventHandlerService: EventHandlerService | null = null;

    setEventHandlerService(service: EventHandlerService): void {
        this.eventHandlerService = service;
    }

    registerEvents(plugin: any): void {
        this.eventHandlerService?.registerEvents(plugin);
    }

    setDependencies(componentLifecycleManager: ComponentLifecycleManager, leafInspectionService: LeafInspectionService): void {
        this.eventHandlerService?.setDependencies(componentLifecycleManager, leafInspectionService);
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
    }

    cleanup(): void {
        this.initialized = false;
    }
}
