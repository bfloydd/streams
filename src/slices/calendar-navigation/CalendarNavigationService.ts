import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { CalendarComponent } from './CalendarComponent';
import { CREATE_FILE_VIEW_TYPE } from '../../shared/constants';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { measurePerformance, registerCleanupTask } from '../../shared';

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
                this.log('Active leaf changed');
                // Add a small delay to ensure the view is fully initialized
                setTimeout(() => {
                    if (leaf?.view instanceof MarkdownView) {
                        this.updateCalendarComponent(leaf);
                    } else if (leaf?.view.getViewType() === CREATE_FILE_VIEW_TYPE) {
                        this.updateCalendarComponentForCreateView(leaf);
                    }
                }, 100);
            })
        );

        // Handle new leaves being created (new tabs opened) and layout changes
        plugin.registerEvent(
            plugin.app.workspace.on('layout-change', () => {
                // Small delay to ensure new views are fully initialized
                setTimeout(() => {
                    this.refreshCalendarComponentsForNewViews();
                }, 200);
            })
        );
        
        // Handle when leaves become visible (e.g., when switching between split views)
        plugin.registerEvent(
            plugin.app.workspace.on('resize', () => {
                // Small delay to ensure the resize is complete
                setTimeout(() => {
                    this.refreshCalendarComponentsForNewViews();
                }, 100);
            })
        );

        // Handle file open events to ensure calendar components are created
        plugin.registerEvent(
            plugin.app.workspace.on('file-open', (file) => {
                if (file) {
                    this.log(`File opened: ${file.path}`);
                    // Small delay to ensure the view is fully initialized
                    setTimeout(() => {
                        this.ensureCalendarComponentForFile(file.path);
                    }, 100);
                }
            })
        );

        // Update calendar when create file state changes
        plugin.registerEvent(
            // @ts-ignore - Custom event not in Obsidian type definitions
            plugin.app.workspace.on('streams-create-file-state-changed', (view: { leaf?: WorkspaceLeaf }) => {
                this.log('Create file state changed, updating calendar component');
                if (view && view.leaf) {
                    this.updateCalendarComponentForCreateView(view.leaf);
                }
            })
        );
    }

    private registerPluginViews(): void {
        const plugin = this.getPlugin();
        
        // Register CreateFileView
        plugin.registerView(
            CREATE_FILE_VIEW_TYPE,
            (leaf) => {
                // This will be implemented when we create the file operations slice
                return null as any;
            }
        );
    }

    public updateCalendarComponent(leaf: WorkspaceLeaf): void {
        const settings = this.getSettings();
        if (!settings.showCalendarComponent) {
            this.removeAllCalendarComponents();
            return;
        }

        const activeStream = this.getActiveStream();
        if (!activeStream) {
            this.log('No active stream, skipping calendar component');
            return;
        }

        const view = leaf.view as MarkdownView;
        if (!view) return;

        const component = new CalendarComponent(
            leaf, 
            activeStream, 
            this.getPlugin().app, 
            settings.reuseCurrentTab, 
            this.getStreams(), 
            this.getPlugin() as any
        );
        
        this.calendarComponents.set(leaf.toString(), component);
    }

    public updateCalendarComponentForCreateView(leaf: WorkspaceLeaf): void {
        const settings = this.getSettings();
        if (!settings.showCalendarComponent) {
            this.removeAllCalendarComponents();
            return;
        }

        const activeStream = this.getActiveStream();
        if (!activeStream) {
            this.log('No active stream, skipping calendar component for create view');
            return;
        }

        const component = new CalendarComponent(
            leaf, 
            activeStream, 
            this.getPlugin().app, 
            settings.reuseCurrentTab, 
            this.getStreams(), 
            this.getPlugin() as any
        );
        
        this.calendarComponents.set(leaf.toString(), component);
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
        const activeLeaf = this.getPlugin().app.workspace.activeLeaf;
        if (activeLeaf) {
            this.updateCalendarComponent(activeLeaf);
        }
    }

    private ensureCalendarComponentForFile(filePath: string): void {
        const activeLeaf = this.getPlugin().app.workspace.activeLeaf;
        if (activeLeaf) {
            this.updateCalendarComponent(activeLeaf);
        }
    }
}