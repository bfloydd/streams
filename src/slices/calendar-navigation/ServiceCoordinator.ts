import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/BaseSlice';
import { configurationService } from '../../shared/ConfigurationService';
import { StreamsSettings } from '../../shared/types';
import { eventBus, EVENTS } from '../../shared/EventBus';
import { registerCleanupTask } from '../../shared';
import { ViewRegistrationService } from './ViewRegistrationService';
import { CalendarViewService } from './CalendarViewService';
import { LeafInspectionService } from './LeafInspectionService';
import { ComponentLifecycleManager } from './ComponentLifecycleManager';
import { EventHandlerService } from './EventHandlerService';
import { StreamDataService } from './StreamDataService';
import { StreamProviderService } from './StreamProviderService';
import { FilePathProviderService } from './FilePathProviderService';
import { ViewCoordinator } from './ViewCoordinator';
import { ComponentCoordinator } from './ComponentCoordinator';
import { EventCoordinator } from './EventCoordinator';

/**
 * Service coordinator for calendar navigation functionality
 * Orchestrates the initialization and lifecycle of calendar navigation services.
 * No longer implements StreamProvider/FilePathProvider - delegates to specialized services.
 *
 * This follows the Single Responsibility Principle by focusing solely on
 * coordination and orchestration, delegating specific responsibilities to focused services.
 */
export class ServiceCoordinator extends SettingsAwareSliceService {
    private viewCoordinator: ViewCoordinator | null = null;
    private componentCoordinator: ComponentCoordinator | null = null;
    private eventCoordinator: EventCoordinator | null = null;

    // Keep the underlying services for initialization
    private viewRegistrationService: ViewRegistrationService | null = null;
    private calendarViewService: CalendarViewService | null = null;
    private leafInspectionService: LeafInspectionService | null = null;
    private componentLifecycleManager: ComponentLifecycleManager | null = null;
    private eventHandlerService: EventHandlerService | null = null;
    private streamDataService: StreamDataService | null = null;
    private streamProviderService: StreamProviderService | null = null;
    private filePathProviderService: FilePathProviderService | null = null;
    private isInitializing = true;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize services
        this.initializeServices();

        // Use coordinators for specific responsibilities
        this.viewCoordinator?.registerPluginViews((viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any) => {
            this.getPlugin().registerView(viewType, viewCreator);
        });
        this.eventCoordinator?.registerEvents(this.getPlugin());
        this.registerCleanupTasks();

        // Initialize calendar components for existing views
        setTimeout(() => {
            this.componentCoordinator?.refreshAllStreamsBarComponents();
            this.componentCoordinator?.setInitializing(false);
            this.isInitializing = false;
        }, configurationService.getTimingConfig().INITIALIZATION_DELAY);

        this.initialized = true;
    }

    private initializeServices(): void {
        const plugin = this.getPlugin();

        // Initialize data services first
        this.streamDataService = new StreamDataService(() => this.getSettingsManager());

        // Initialize provider services
        this.streamProviderService = new StreamProviderService(this.streamDataService);
        this.filePathProviderService = new FilePathProviderService(this.streamDataService);

        // Initialize focused services with injected providers
        this.viewRegistrationService = new ViewRegistrationService(
            plugin.app,
            this.streamProviderService, // inject StreamProvider
            this.filePathProviderService  // inject FilePathProvider
        );

        this.calendarViewService = new CalendarViewService();
        this.leafInspectionService = new LeafInspectionService();

        // Initialize remaining services
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

        // Initialize coordinators
        this.initializeCoordinators();
    }

    private initializeCoordinators(): void {
        // Create coordinators
        this.viewCoordinator = new ViewCoordinator();
        this.componentCoordinator = new ComponentCoordinator();
        this.eventCoordinator = new EventCoordinator();

        // Set up coordinator dependencies
        this.viewCoordinator.setViewRegistrationService(this.viewRegistrationService!);
        this.componentCoordinator.setComponentLifecycleManager(this.componentLifecycleManager!);
        this.eventCoordinator.setEventHandlerService(this.eventHandlerService!);
        this.eventCoordinator.setDependencies(this.componentLifecycleManager!, this.leafInspectionService!);
    }

    cleanup(): void {
        this.componentCoordinator?.removeAllComponents();
        this.initialized = false;
    }


    onSettingsChanged(settings: StreamsSettings): void {
        // Update existing components with new settings
        this.componentCoordinator?.updateExistingComponentsSettings(settings);

        // Also refresh components for new views
        this.componentCoordinator?.updateAllStreamsBarComponents();
    }

    private registerCleanupTasks(): void {
        // Register cleanup task for memory management
        registerCleanupTask(() => {
            this.componentCoordinator?.removeAllComponents();
        });
    }




    public updateStreamsBarComponent(leaf: WorkspaceLeaf): void {
        this.componentCoordinator?.updateStreamsBarComponent(leaf);
    }

    public updateAllStreamsBarComponents(): void {
        this.componentCoordinator?.updateAllStreamsBarComponents();
    }

    public refreshAllStreamsBarComponents(): void {
        this.componentCoordinator?.refreshAllStreamsBarComponents();
    }



}
