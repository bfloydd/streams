import { App, WorkspaceLeaf } from 'obsidian';
import { Stream, StreamsSettings } from '../../shared/types';
import { StreamsBarComponent } from './StreamsBarComponent';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { serviceRegistry } from '../../shared';
import { CalendarViewService } from './CalendarViewService';
import { LeafInspectionService } from './LeafInspectionService';
import { measurePerformance } from '../../shared';
import { configurationService } from '../../shared/ConfigurationService';

/**
 * Manages the lifecycle of StreamsBarComponent instances
 * Enhanced to include component management methods from CalendarNavigationService
 * Follows Single Responsibility Principle for UI component lifecycle
 */
export class ComponentLifecycleManager {
    private calendarComponents: Map<string, StreamsBarComponent> = new Map();
    private app: App;
    private calendarViewService: CalendarViewService;
    private leafInspectionService: LeafInspectionService;
    private streamDataService: any; // Will be injected
    private getSettings: () => any;
    private getPlugin: () => any;

    constructor(
        app: App,
        calendarViewService: CalendarViewService,
        leafInspectionService: LeafInspectionService,
        getSettings: () => any,
        getPlugin: () => any
    ) {
        this.app = app;
        this.calendarViewService = calendarViewService;
        this.leafInspectionService = leafInspectionService;
        this.getSettings = getSettings;
        this.getPlugin = getPlugin;
    }

    /**
     * Set stream data service dependency
     */
    setStreamDataService(streamDataService: any): void {
        this.streamDataService = streamDataService;
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
                this.streamDataService?.getStreams() || [],
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
    updateExistingComponentsSettings(settings: StreamsSettings): void {
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
        return this.streamDataService?.getStreamToUse();
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

    /**
     * Update streams bar component for a specific leaf
     * Moved from CalendarNavigationService
     */
    updateStreamsBarComponent(leaf: WorkspaceLeaf): void {
        // Only create calendar components for leaves in the main editor area
        if (!this.leafInspectionService?.isMainEditorLeaf(leaf)) {
            return;
        }

        const settings = this.getSettings();
        if (!settings.showStreamsBarComponent) {
            this.removeAllComponents();
            return;
        }

        const viewType = leaf.view.getViewType();

        // Handle all editor view types that should have calendar components
        if (!this.calendarViewService?.shouldCreateCalendarForViewType(viewType)) {
            return;
        }

        // Get active stream or default stream
        const streamToUse = this.getStreamToUse();
        if (!streamToUse) {
            return;
        }

        // Create calendar component for this leaf
        this.createComponentForLeaf(leaf, streamToUse);
    }

    /**
     * Update all streams bar components
     * Moved from CalendarNavigationService
     */
    updateAllStreamsBarComponents = measurePerformance((): void => {
        this.refreshStreamsBarComponentsForNewViews();
    }, 'calendar-navigation', { operation: 'updateAllStreamsBarComponents' });

    /**
     * Refresh all streams bar components
     * Moved from CalendarNavigationService
     */
    refreshAllStreamsBarComponents(): void {
        this.refreshStreamsBarComponentsForNewViews();
    }

    /**
     * Refresh streams bar components for new views
     * Moved from CalendarNavigationService
     */
    private refreshStreamsBarComponentsForNewViews(): void {
        // Get all leaves in the main editor area
        const plugin = this.getPlugin();
        const allLeaves = plugin.app.workspace.getLeavesOfType('empty');
        const markdownLeaves = plugin.app.workspace.getLeavesOfType('markdown');
        const createFileLeaves = plugin.app.workspace.getLeavesOfType(configurationService.getViewConfig().CREATE_FILE_VIEW_TYPE);

        // Combine all editor leaves
        const allEditorLeaves = [...allLeaves, ...markdownLeaves, ...createFileLeaves];

        // Also check the active leaf specifically
        const activeLeaf = plugin.app.workspace.activeLeaf;
        if (activeLeaf && this.leafInspectionService.isMainEditorLeaf(activeLeaf)) {
            this.ensureStreamsBarComponentForLeaf(activeLeaf);
        }

        // Process all editor leaves, but only if they're in the main editor area
        allEditorLeaves.forEach(leaf => {
            if (this.leafInspectionService?.isMainEditorLeaf(leaf)) {
                this.ensureStreamsBarComponentForLeaf(leaf);
            }
        });
    }

    /**
     * Ensure streams bar component exists for a specific leaf
     * Moved from CalendarNavigationService
     */
    ensureStreamsBarComponentForLeaf(leaf: WorkspaceLeaf): void {
        // Check if this leaf already has a component
        if (this.hasComponentForLeaf(leaf)) {
            return;
        }

        // Only create component if settings allow it
        const settings = this.getSettings();
        if (!settings.showStreamsBarComponent) {
            return;
        }

        // Get active stream or default stream
        const streamToUse = this.getStreamToUse();
        if (!streamToUse) {
            return;
        }

        // Create component for this leaf
        this.createComponentForLeaf(leaf, streamToUse);
    }

    /**
     * Ensure component exists for a file path
     * Moved from CalendarNavigationService
     */
    private async ensureStreamsBarComponentForFile(filePath: string): Promise<void> {
        const plugin = this.getPlugin();
        const activeLeaf = plugin.app.workspace.activeLeaf;
        if (activeLeaf) {
            this.ensureStreamsBarComponentForLeaf(activeLeaf);
            await this.ensureComponentForFile(filePath, activeLeaf);
        }
    }
}

