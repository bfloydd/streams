import { App, WorkspaceLeaf } from 'obsidian';
import { BaseSliceService } from '../../shared/base-slice';
import { StreamsSettings } from '../../shared/types';
import { ComponentLifecycleManager } from './ComponentLifecycleManager';

/**
 * Coordinator for UI component lifecycle management
 * Handles the creation, updating, and cleanup of calendar navigation components
 */
export class ComponentCoordinator extends BaseSliceService {
    private componentLifecycleManager: ComponentLifecycleManager | null = null;
    private isInitializing = true;

    setComponentLifecycleManager(manager: ComponentLifecycleManager): void {
        this.componentLifecycleManager = manager;
    }

    setInitializing(initializing: boolean): void {
        this.isInitializing = initializing;
    }

    updateStreamsBarComponent(leaf: WorkspaceLeaf): void {
        this.componentLifecycleManager?.updateStreamsBarComponent(leaf);
    }

    updateAllStreamsBarComponents(): void {
        if (this.isInitializing) return;
        this.componentLifecycleManager?.updateAllStreamsBarComponents();
    }

    refreshAllStreamsBarComponents(): void {
        this.componentLifecycleManager?.refreshAllStreamsBarComponents();
    }

    updateExistingComponentsSettings(settings: StreamsSettings): void {
        this.componentLifecycleManager?.updateExistingComponentsSettings(settings);
    }

    removeAllComponents(): void {
        this.componentLifecycleManager?.removeAllComponents();
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
    }

    cleanup(): void {
        this.removeAllComponents();
        this.initialized = false;
    }
}