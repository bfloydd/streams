import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { CalendarComponent } from './CalendarComponent';
import { CREATE_FILE_VIEW_TYPE } from '../../shared/constants';
import { CreateFileView } from '../file-operations/CreateFileView';
import { Stream } from '../../shared/types';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { measurePerformance, registerCleanupTask } from '../../shared';
import { centralizedLogger } from '../../shared/centralized-logger';

export class CalendarNavigationService extends SettingsAwareSliceService {
    private calendarComponents: Map<string, CalendarComponent> = new Map();
    private isInitializing = true;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.registerEventHandlers();
        this.registerPluginViews();
        this.registerEventBusListeners();
        this.registerCleanupTasks();
        
        // Initialize calendar components for existing views
        setTimeout(() => {
            this.refreshCalendarComponentsForNewViews();
            this.isInitializing = false;
        }, 100);

        this.initialized = true;
    }

    cleanup(): void {
        this.removeAllCalendarComponents();
        this.calendarComponents.clear();
        this.initialized = false;
    }

    private registerEventBusListeners(): void {
        // Listen for stream changes
        eventBus.subscribe(EVENTS.STREAM_ADDED, () => this.updateAllCalendarComponents());
        eventBus.subscribe(EVENTS.STREAM_UPDATED, () => this.updateAllCalendarComponents());
        eventBus.subscribe(EVENTS.STREAM_REMOVED, () => this.updateAllCalendarComponents());
        eventBus.subscribe(EVENTS.ACTIVE_STREAM_CHANGED, () => this.updateAllCalendarComponents());
        
        // Listen for settings changes
        eventBus.subscribe(EVENTS.SETTINGS_CHANGED, () => this.updateAllCalendarComponents());
    }

    onSettingsChanged(settings: any): void {
        this.updateAllCalendarComponents();
    }

    private registerCleanupTasks(): void {
        // Register cleanup task for memory management
        registerCleanupTask(() => {
            this.removeAllCalendarComponents();
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

        // Handle active leaf changes
        plugin.registerEvent(
            plugin.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf) {
                    if (leaf.view instanceof MarkdownView) {
                        this.updateCalendarComponent(leaf);
                    } else if (leaf.view.getViewType() === CREATE_FILE_VIEW_TYPE) {
                        this.updateCalendarComponentForCreateView(leaf);
                    } else if (leaf.view.getViewType() === 'empty') {
                        this.updateCalendarComponent(leaf);
                    }
                }
            })
        );

        // Handle new leaves being created (new tabs opened) and layout changes
        plugin.registerEvent(
            plugin.app.workspace.on('layout-change', () => {
                this.refreshCalendarComponentsForNewViews();
            })
        );
        
        // Handle when leaves become visible (e.g., when switching between split views)
        plugin.registerEvent(
            plugin.app.workspace.on('resize', () => {
                this.refreshCalendarComponentsForNewViews();
            })
        );

        // Handle file open events to ensure calendar components are created
        plugin.registerEvent(
            plugin.app.workspace.on('file-open', (file) => {
                if (file) {
                    setTimeout(() => {
                        this.ensureCalendarComponentForFile(file.path);
                    }, 100);
                }
            })
        );

        // Update calendar when create file view is opened
        eventBus.subscribe('create-file-view-opened', (event) => {

            if (event.data) {
                this.updateCalendarComponentForCreateView(event.data);
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

    public updateCalendarComponent(leaf: WorkspaceLeaf): void {

        // Handle empty views and other view types that should have calendar components
        const viewType = leaf.view.getViewType();
        const shouldCreateCalendar = viewType === 'empty' || viewType === 'file-explorer' || viewType === 'search' || viewType === 'graph';
        
        if (shouldCreateCalendar) {

            // Remove any existing components first to ensure we create a fresh one
            const existingComponents = leaf.view.containerEl.querySelectorAll('.streams-calendar-component');

            existingComponents.forEach(component => {

                component.remove();
            });
            
            // Create calendar component for view - use active stream or default stream
            let streamToUse = this.getActiveStream();
            if (!streamToUse) {
                // If no active stream, try to get the first available stream
                const streams = this.getStreams();
                if (streams && streams.length > 0) {
                    streamToUse = streams[0];

                }
            }
            
            if (streamToUse) {

                this.createCalendarComponentForLeaf(leaf, streamToUse);
            } else {

            }
            return;
        }
        
        const settings = this.getSettings();
        if (!settings.showCalendarComponent) {

            this.removeAllCalendarComponents();
            return;
        }

        // Don't remove existing components unless we're switching to a different view type
        // that doesn't support calendar components
        if (leaf.view.getViewType() !== 'markdown' && leaf.view.getViewType() !== CREATE_FILE_VIEW_TYPE) {

            return;
        }

        const activeStream = this.getActiveStream();
        if (!activeStream) {

            return;
        }

        const view = leaf.view as MarkdownView;
        if (!view) return;

        // Remove any existing components first to ensure we create a fresh one
        const existingComponents = view.contentEl.querySelectorAll('.streams-calendar-component');
        existingComponents.forEach(component => {

            component.remove();
        });

        const component = new CalendarComponent(
            leaf, 
            activeStream, 
            this.getPlugin().app, 
            settings.reuseCurrentTab, 
            this.getStreams(), 
            this.getPlugin() as any
        );
        
        const componentKey = `leaf-${Math.random().toString(36).substr(2, 9)}`;
        this.calendarComponents.set(componentKey, component);

    }

    public updateCalendarComponentForCreateView(leaf: WorkspaceLeaf): void {
        const settings = this.getSettings();
        if (!settings.showCalendarComponent) {
            this.removeAllCalendarComponents();
            return;
        }

        const activeStream = this.getActiveStream();
        if (!activeStream) {

            return;
        }

        // Remove any existing components first to ensure we create a fresh one
        const existingComponents = leaf.view.containerEl.querySelectorAll('.streams-calendar-component');
        existingComponents.forEach(component => {

            component.remove();
        });

        const component = new CalendarComponent(
            leaf, 
            activeStream, 
            this.getPlugin().app, 
            settings.reuseCurrentTab, 
            this.getStreams(), 
            this.getPlugin() as any
        );
        
        const componentKey = `leaf-${Math.random().toString(36).substr(2, 9)}`;
        this.calendarComponents.set(componentKey, component);

    }

    public updateAllCalendarComponents = measurePerformance((): void => {
        if (this.isInitializing) return;
        
        this.refreshCalendarComponentsForNewViews();
    }, 'calendar-navigation', 'updateAllCalendarComponents');

    public refreshAllCalendarComponents(): void {
        this.refreshCalendarComponentsForNewViews();
    }

    private removeAllCalendarComponents(): void {

        for (const component of this.calendarComponents.values()) {

            component.unload();
        }
        this.calendarComponents.clear();

    }

    private refreshCalendarComponentsForNewViews(): void {

        // Get all leaves and check their types
        const allLeaves = this.getPlugin().app.workspace.getLeavesOfType('empty');

        // Also check the active leaf specifically
        const activeLeaf = this.getPlugin().app.workspace.activeLeaf;
        if (activeLeaf) {

            this.updateCalendarComponent(activeLeaf);
        }
        
        // Process all empty leaves
        allLeaves.forEach(leaf => {

            this.updateCalendarComponent(leaf);
        });
    }

    private ensureCalendarComponentForFile(filePath: string): void {
        const activeLeaf = this.getPlugin().app.workspace.activeLeaf;
        if (activeLeaf) {
            this.updateCalendarComponent(activeLeaf);
        }
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
            addCommand: true
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

    private createCalendarComponentForLeaf(leaf: WorkspaceLeaf, activeStream: Stream): void {
        const settings = this.getSettings();

        // Remove any existing components first to ensure we create a fresh one
        const existingComponents = leaf.view.containerEl.querySelectorAll('.streams-calendar-component');

        existingComponents.forEach(component => {

            component.remove();
        });
        
        try {
            const component = new CalendarComponent(
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
                const domComponents = leaf.view.containerEl.querySelectorAll('.streams-calendar-component');

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