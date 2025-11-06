import { App, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../shared/types';
import { StreamsBarComponent } from './StreamsBarComponent';
import { centralizedLogger } from '../../shared/centralized-logger';
import { serviceRegistry } from '../../shared';

/**
 * Manages the lifecycle of StreamsBarComponent instances
 * Extracted from CalendarNavigationService to follow Single Responsibility Principle
 */
export class ComponentLifecycleManager {
    private calendarComponents: Map<string, StreamsBarComponent> = new Map();
    private app: App;
    private getStreams: () => Stream[];
    private getActiveStream: () => Stream | undefined;
    private getSettings: () => any;
    private getPlugin: () => any;

    constructor(
        app: App,
        getStreams: () => Stream[],
        getActiveStream: () => Stream | undefined,
        getSettings: () => any,
        getPlugin: () => any
    ) {
        this.app = app;
        this.getStreams = getStreams;
        this.getActiveStream = getActiveStream;
        this.getSettings = getSettings;
        this.getPlugin = getPlugin;
    }

    /**
     * Create a StreamsBarComponent for a given leaf
     */
    createComponentForLeaf(leaf: WorkspaceLeaf, activeStream: Stream): void {
        const settings = this.getSettings();

        // Remove any existing components first to ensure we create a fresh one
        const existingComponents = leaf.view.containerEl.querySelectorAll('.streams-bar-component');
        existingComponents.forEach(component => {
            component.remove();
        });
        
        try {
            const component = new StreamsBarComponent(
                leaf, 
                activeStream, 
                this.app, 
                settings.reuseCurrentTab, 
                this.getStreams(), 
                this.getPlugin()
            );
            
            const componentKey = `leaf-${Math.random().toString(36).substr(2, 9)}`;
            this.calendarComponents.set(componentKey, component);

            // Verify the component was actually added to the DOM
            setTimeout(() => {
                const domComponents = leaf.view.containerEl.querySelectorAll('.streams-bar-component');

                if (domComponents.length === 0) {
                    centralizedLogger.error(`[ComponentLifecycleManager] ERROR: Calendar component was not added to DOM!`);
                }
            }, 100);
            
        } catch (error) {
            centralizedLogger.error(`[ComponentLifecycleManager] Error creating calendar component:`, error);
        }
    }

    /**
     * Update settings for all existing components
     */
    updateExistingComponentsSettings(settings: any): void {
        // Update the reuseCurrentTab setting for all existing components
        for (const component of this.calendarComponents.values()) {
            if (component && typeof component.updateReuseCurrentTab === 'function') {
                component.updateReuseCurrentTab(settings.reuseCurrentTab);
            }
            
            // Refresh bar style for all existing components
            if (component && typeof component.refreshBarStyle === 'function') {
                component.refreshBarStyle();
            }
            
            // Update streams list for all existing components
            if (component && typeof component.updateStreamsList === 'function' && settings.streams) {
                component.updateStreamsList(settings.streams);
            }
        }
        
        // Force immediate refresh for mobile devices
        // Use requestAnimationFrame to ensure DOM updates are processed
        requestAnimationFrame(() => {
            // Force a reflow to ensure all changes are visible
            for (const component of this.calendarComponents.values()) {
                if (component && typeof component.refreshStreamsDropdown === 'function') {
                    component.refreshStreamsDropdown();
                }
            }
        });
    }

    /**
     * Remove all components
     */
    removeAllComponents(): void {
        for (const component of this.calendarComponents.values()) {
            component.unload();
        }
        this.calendarComponents.clear();
    }

    /**
     * Get all components
     */
    getAllComponents(): Map<string, StreamsBarComponent> {
        return this.calendarComponents;
    }

    /**
     * Check if a leaf already has a component
     */
    hasComponentForLeaf(leaf: WorkspaceLeaf): boolean {
        const existingComponent = leaf.view.containerEl.querySelector('.streams-bar-component');
        return !!existingComponent;
    }

    /**
     * Get stream to use for a component (active stream or default)
     */
    getStreamToUse(): Stream | undefined {
        let streamToUse = this.getActiveStream();
        if (!streamToUse) {
            // If no active stream, try to get the first available stream
            const streams = this.getStreams();
            if (streams && streams.length > 0) {
                streamToUse = streams[0];
            }
        }
        return streamToUse;
    }

    /**
     * Ensure component exists for a file path
     */
    async ensureComponentForFile(filePath: string, activeLeaf: WorkspaceLeaf | null): Promise<void> {
        if (activeLeaf) {
            // Check if this file belongs to a stream and update the stream bar accordingly
            const apiService = serviceRegistry.api;
            if (apiService) {
                const stream = apiService.getStreamForFile(filePath);
                if (stream) {
                    // This is a stream file, update the stream bar to reflect the file's stream and date
                    await apiService.updateStreamBarFromFile(filePath);
                    centralizedLogger.debug(`Updated stream bar for file: ${filePath}`);
                }
            }
        }
    }
}

