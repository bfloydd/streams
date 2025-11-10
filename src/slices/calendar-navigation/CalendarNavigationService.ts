import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { configurationService } from '../../shared/configuration-service';
import { Stream, StreamsSettings } from '../../shared/types';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { registerCleanupTask } from '../../shared';
import { StreamProvider, FilePathProvider } from '../../shared/interfaces';
import { ViewRegistrationService } from './ViewRegistrationService';
import { CalendarViewService } from './CalendarViewService';
import { LeafInspectionService } from './LeafInspectionService';
import { ComponentLifecycleManager } from './ComponentLifecycleManager';
import { EventHandlerService } from './EventHandlerService';
import { StreamDataService } from './StreamDataService';

export class CalendarNavigationService extends SettingsAwareSliceService implements StreamProvider, FilePathProvider {
    private viewRegistrationService: ViewRegistrationService | null = null;
    private calendarViewService: CalendarViewService | null = null;
    private leafInspectionService: LeafInspectionService | null = null;
    private componentLifecycleManager: ComponentLifecycleManager | null = null;
    private eventHandlerService: EventHandlerService | null = null;
    private streamDataService: StreamDataService | null = null;
    private isInitializing = true;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize services
        this.initializeServices();

        this.registerPluginViews();
        this.eventHandlerService?.registerEvents(this.getPlugin());
        this.registerCleanupTasks();
        
        // Initialize calendar components for existing views
        setTimeout(() => {
            this.componentLifecycleManager?.refreshAllStreamsBarComponents();
            this.isInitializing = false;
        }, configurationService.getTimingConfig().INITIALIZATION_DELAY);

        this.initialized = true;
    }

    private initializeServices(): void {
        const plugin = this.getPlugin();

        // Initialize focused services
        this.viewRegistrationService = new ViewRegistrationService(
            plugin.app,
            this, // implements StreamProvider
            this  // implements FilePathProvider
        );

        this.calendarViewService = new CalendarViewService();
        this.leafInspectionService = new LeafInspectionService();

        // Initialize new services
        this.streamDataService = new StreamDataService(() => this.getSettingsManager());
        this.eventHandlerService = new EventHandlerService(plugin.app);

        this.componentLifecycleManager = new ComponentLifecycleManager(
            plugin.app,
            this.calendarViewService,
            this.leafInspectionService,
            () => this.getSettings(),
            () => this.getPlugin()
        );

        // Set dependencies
        this.componentLifecycleManager.setStreamDataService(this.streamDataService);
        this.eventHandlerService.setDependencies(this.componentLifecycleManager, this.leafInspectionService);
    }

    cleanup(): void {
        if (this.componentLifecycleManager) {
            this.componentLifecycleManager.removeAllComponents();
        }
        this.initialized = false;
    }


    onSettingsChanged(settings: StreamsSettings): void {
        // Update existing components with new settings
        this.componentLifecycleManager?.updateExistingComponentsSettings(settings);

        // Also refresh components for new views
        this.componentLifecycleManager?.updateAllStreamsBarComponents();
    }

    private registerCleanupTasks(): void {
        // Register cleanup task for memory management
        registerCleanupTask(() => {
            if (this.componentLifecycleManager) {
                this.componentLifecycleManager.removeAllComponents();
            }
        });
    }



    private registerPluginViews(): void {
        const plugin = this.getPlugin();

        if (this.viewRegistrationService) {
            this.viewRegistrationService.registerPluginViews({
                registerView: (viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any) => {
                    plugin.registerView(viewType, viewCreator);
                }
            });
        }
    }

    public updateStreamsBarComponent(leaf: WorkspaceLeaf): void {
        this.componentLifecycleManager?.updateStreamsBarComponent(leaf);
    }

    public updateAllStreamsBarComponents(): void {
        if (this.isInitializing) return;
        this.componentLifecycleManager?.updateAllStreamsBarComponents();
    }

    public refreshAllStreamsBarComponents(): void {
        this.componentLifecycleManager?.refreshAllStreamsBarComponents();
    }



    getStreams(): Stream[] {
        return this.streamDataService?.getStreams() || [];
    }

    getDefaultStream(): Stream {
        return this.streamDataService?.getDefaultStream() || {
            id: 'default',
            name: 'Default Stream',
            icon: 'book',
            folder: 'Streams',
            showTodayInRibbon: true,
            addCommand: true,
            encryptThisStream: false,
            disabled: false
        };
    }

    getDefaultFilePath(stream: Stream): string {
        return this.streamDataService?.getDefaultFilePath(stream) || `${stream.folder}/default.md`;
    }

    getActiveStream(): Stream | undefined {
        return this.streamDataService?.getActiveStream();
    }

}