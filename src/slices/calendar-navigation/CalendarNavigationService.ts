import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { StreamsBarComponent } from './StreamsBarComponent';
import { CREATE_FILE_VIEW_TYPE } from '../../shared/constants';
import { CreateFileView } from '../file-operations/CreateFileView';
import { Stream } from '../../shared/types';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { measurePerformance, registerCleanupTask } from '../../shared';
import { centralizedLogger } from '../../shared/centralized-logger';

export class CalendarNavigationService extends SettingsAwareSliceService {
    private calendarComponents: Map<string, StreamsBarComponent> = new Map();
    private isInitializing = true;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.registerEventHandlers();
        this.registerPluginViews();
        this.registerEventBusListeners();
        this.registerCleanupTasks();
        
        // Initialize calendar components for existing views
        setTimeout(() => {
            this.refreshStreamsBarComponentsForNewViews();
            this.isInitializing = false;
        }, 100);

        this.initialized = true;
    }

    cleanup(): void {
        this.removeAllStreamsBarComponents();
        this.calendarComponents.clear();
        this.initialized = false;
    }

    private registerEventBusListeners(): void {
        // Listen for stream changes
        eventBus.subscribe(EVENTS.STREAM_ADDED, () => this.updateAllStreamsBarComponents());
        eventBus.subscribe(EVENTS.STREAM_UPDATED, () => this.updateAllStreamsBarComponents());
        eventBus.subscribe(EVENTS.STREAM_REMOVED, () => this.updateAllStreamsBarComponents());
        eventBus.subscribe(EVENTS.ACTIVE_STREAM_CHANGED, () => this.updateAllStreamsBarComponents());
        
        // Listen for settings changes
        eventBus.subscribe(EVENTS.SETTINGS_CHANGED, (event) => this.onSettingsChanged(event.data));
    }

    onSettingsChanged(settings: any): void {
        // Update existing components with new settings
        this.updateExistingComponentsSettings(settings);
        
        // Also refresh components for new views
        this.updateAllStreamsBarComponents();
    }

    private registerCleanupTasks(): void {
        // Register cleanup task for memory management
        registerCleanupTask(() => {
            this.removeAllStreamsBarComponents();
            this.calendarComponents.clear();
        });
    }

    protected getStreams(): any[] {
        const plugin = this.getPlugin() as any;
        return plugin.settings?.streams || [];
    }

    protected getActiveStream(): any {
        const plugin = this.getPlugin() as any;
        const activeStreamId = plugin.settings?.activeStreamId;
        if (!activeStreamId) return undefined;
        return this.getStreams().find((s: any) => s.id === activeStreamId);
    }

    private registerEventHandlers(): void {
        const plugin = this.getPlugin();

        // Handle active leaf changes - only ensure component exists, don't recreate unnecessarily
        plugin.registerEvent(
            plugin.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf && this.isMainEditorLeaf(leaf)) {
                    this.ensureStreamsBarComponentForLeaf(leaf);
                }
            })
        );

        // Handle new leaves being created (new tabs opened) and layout changes
        plugin.registerEvent(
            plugin.app.workspace.on('layout-change', () => {
                this.refreshStreamsBarComponentsForNewViews();
            })
        );
        
        // Handle when leaves become visible (e.g., when switching between split views)
        plugin.registerEvent(
            plugin.app.workspace.on('resize', () => {
                this.refreshStreamsBarComponentsForNewViews();
            })
        );

        // Handle file open events to ensure calendar components are created
        plugin.registerEvent(
            plugin.app.workspace.on('file-open', (file) => {
                if (file) {
                    setTimeout(() => {
                        this.ensureStreamsBarComponentForFile(file.path);
                    }, 100);
                }
            })
        );

        // Update calendar when create file view is opened
        eventBus.subscribe('create-file-view-opened', (event) => {
            if (event.data) {
                this.updateStreamsBarComponent(event.data);
            }
        });
    }

    private registerPluginViews(): void {
        const plugin = this.getPlugin();
        
        // Register CreateFileView
        plugin.registerView(
            CREATE_FILE_VIEW_TYPE,
            (leaf) => {
                try {
                    // Create a proper CreateFileView instance
                    // We'll need to get the stream and filePath from the leaf's state or create defaults
                    const defaultStream = this.getDefaultStream();
                    const defaultFilePath = this.getDefaultFilePath(defaultStream);
                    
                    const view = new CreateFileView(leaf, plugin.app, defaultFilePath, defaultStream);

                    return view;
                } catch (error) {
                    centralizedLogger.error(`[CalendarNavigationService] Error creating CreateFileView:`, error);
                    // Return a minimal view that won't cause errors
                    return {
                        getViewType: () => CREATE_FILE_VIEW_TYPE,
                        getDisplayText: () => 'Create File',
                        getState: () => ({}),
                        setState: () => Promise.resolve(),
                        onOpen: () => Promise.resolve(),
                        onClose: () => Promise.resolve()
                    } as any;
                }
            }
        );
    }

    public updateStreamsBarComponent(leaf: WorkspaceLeaf): void {
        // Only create calendar components for leaves in the main editor area
        if (!this.isMainEditorLeaf(leaf)) {
            return;
        }

        const settings = this.getSettings();
        if (!settings.showStreamsBarComponent) {
            this.removeAllStreamsBarComponents();
            return;
        }

        const viewType = leaf.view.getViewType();
        
        // Handle all editor view types that should have calendar components
        const shouldCreateCalendar = viewType === 'empty' || 
                                   viewType === 'file-explorer' || 
                                   viewType === 'search' || 
                                   viewType === 'graph' ||
                                   viewType === 'markdown' ||
                                   viewType === CREATE_FILE_VIEW_TYPE;
        
        if (!shouldCreateCalendar) {
            return;
        }

        // Get active stream or default stream
        let streamToUse = this.getActiveStream();
        if (!streamToUse) {
            // If no active stream, try to get the first available stream
            const streams = this.getStreams();
            if (streams && streams.length > 0) {
                streamToUse = streams[0];
            }
        }
        
        if (!streamToUse) {
            return;
        }

        // Remove any existing components first to ensure we create a fresh one
        const existingComponents = leaf.view.containerEl.querySelectorAll('.streams-bar-component');
        existingComponents.forEach(component => {
            component.remove();
        });

        // Create calendar component for this leaf
        this.createStreamsBarComponentForLeaf(leaf, streamToUse);
    }


    public updateAllStreamsBarComponents = measurePerformance((): void => {
        if (this.isInitializing) return;
        
        this.refreshStreamsBarComponentsForNewViews();
    }, 'calendar-navigation', 'updateAllStreamsBarComponents');

    public refreshAllStreamsBarComponents(): void {
        this.refreshStreamsBarComponentsForNewViews();
    }

    private removeAllStreamsBarComponents(): void {

        for (const component of this.calendarComponents.values()) {

            component.unload();
        }
        this.calendarComponents.clear();

    }

    private updateExistingComponentsSettings(settings: any): void {
        // Update the reuseCurrentTab setting for all existing components
        for (const component of this.calendarComponents.values()) {
            if (component && typeof component.updateReuseCurrentTab === 'function') {
                component.updateReuseCurrentTab(settings.reuseCurrentTab);
            }
            
            // Refresh bar style for all existing components
            if (component && typeof component.refreshBarStyle === 'function') {
                component.refreshBarStyle();
            }
        }
    }

    private refreshStreamsBarComponentsForNewViews(): void {
        // Get all leaves in the main editor area
        const allLeaves = this.getPlugin().app.workspace.getLeavesOfType('empty');
        const markdownLeaves = this.getPlugin().app.workspace.getLeavesOfType('markdown');
        const createFileLeaves = this.getPlugin().app.workspace.getLeavesOfType(CREATE_FILE_VIEW_TYPE);
        
        // Combine all editor leaves
        const allEditorLeaves = [...allLeaves, ...markdownLeaves, ...createFileLeaves];

        // Also check the active leaf specifically
        const activeLeaf = this.getPlugin().app.workspace.activeLeaf;
        if (activeLeaf && this.isMainEditorLeaf(activeLeaf)) {
            this.ensureStreamsBarComponentForLeaf(activeLeaf);
        }
        
        // Process all editor leaves, but only if they're in the main editor area
        allEditorLeaves.forEach(leaf => {
            if (this.isMainEditorLeaf(leaf)) {
                this.ensureStreamsBarComponentForLeaf(leaf);
            }
        });
    }

    private isMainEditorLeaf(leaf: WorkspaceLeaf): boolean {
        // Check if the leaf belongs to the main editor area (not sidebars)
        const mainEditorArea = document.querySelector('.workspace-split.mod-vertical.mod-root');
        if (!mainEditorArea) {
            return false;
        }
        
        return mainEditorArea.contains(leaf.view.containerEl);
    }

    private ensureStreamsBarComponentForFile(filePath: string): void {
        const activeLeaf = this.getPlugin().app.workspace.activeLeaf;
        if (activeLeaf) {
            this.ensureStreamsBarComponentForLeaf(activeLeaf);
        }
    }

    private ensureStreamsBarComponentForLeaf(leaf: WorkspaceLeaf): void {
        // Check if this leaf already has a component
        const existingComponent = leaf.view.containerEl.querySelector('.streams-bar-component');
        if (existingComponent) {
            // Component already exists, no need to recreate
            return;
        }

        // Only create component if settings allow it
        const settings = this.getSettings();
        if (!settings.showStreamsBarComponent) {
            return;
        }

        // Get active stream or default stream
        let streamToUse = this.getActiveStream();
        if (!streamToUse) {
            const streams = this.getStreams();
            if (streams && streams.length > 0) {
                streamToUse = streams[0];
            }
        }
        
        if (!streamToUse) {
            return;
        }

        // Create component for this leaf
        this.createStreamsBarComponentForLeaf(leaf, streamToUse);
    }

    private getDefaultStream(): Stream {
        // Get the first available stream or create a default one
        const plugin = this.getPlugin() as any;
        const streams = plugin.settings?.streams || [];
        
        if (streams.length > 0) {
            return streams[0];
        }
        
        // Return a default stream if none exist
        return {
            id: 'default',
            name: 'Default Stream',
            icon: 'book',
            folder: 'Streams',
            showTodayInRibbon: true,
            addCommand: true,
            encryptThisStream: false
        };
    }

    private getDefaultFilePath(stream: Stream): string {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const fileName = `${year}-${month}-${day}.md`;
        
        return `${stream.folder}/${fileName}`;
    }

    private createStreamsBarComponentForLeaf(leaf: WorkspaceLeaf, activeStream: Stream): void {
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
                this.getPlugin().app, 
                settings.reuseCurrentTab, 
                this.getStreams(), 
                this.getPlugin() as any
            );
            
            const componentKey = `leaf-${Math.random().toString(36).substr(2, 9)}`;
            this.calendarComponents.set(componentKey, component);

            // Verify the component was actually added to the DOM
            setTimeout(() => {
                const domComponents = leaf.view.containerEl.querySelectorAll('.streams-bar-component');

                if (domComponents.length === 0) {
                    centralizedLogger.error(`[CalendarNavigationService] ERROR: Calendar component was not added to DOM!`);
                }
            }, 100);
            
        } catch (error) {
            centralizedLogger.error(`[CalendarNavigationService] Error creating calendar component:`, error);
        }
    }

    private getLeafId(leaf: WorkspaceLeaf): string {
        // Use a combination of view type and a random identifier since WorkspaceLeaf doesn't expose id
        return `leaf-${leaf.view.getViewType()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}