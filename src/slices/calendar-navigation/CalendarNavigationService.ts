import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { CREATE_FILE_VIEW_TYPE } from '../../shared/constants';
import { INSTALL_MELD_VIEW_TYPE } from '../file-operations/InstallMeldView';
import { CREATE_FILE_VIEW_ENCRYPTED_TYPE } from '../file-operations/CreateFileViewEncrypted';
import { Stream, StreamsSettings } from '../../shared/types';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { measurePerformance, registerCleanupTask, TIMING } from '../../shared';
import { ViewManagementService } from './ViewManagementService';
import { ComponentLifecycleManager } from './ComponentLifecycleManager';

export class CalendarNavigationService extends SettingsAwareSliceService {
    private viewManagementService: ViewManagementService | null = null;
    private componentLifecycleManager: ComponentLifecycleManager | null = null;
    private isInitializing = true;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize services
        this.initializeServices();

        this.registerEventHandlers();
        this.registerPluginViews();
        this.registerEventBusListeners();
        this.registerCleanupTasks();
        
        // Initialize calendar components for existing views
        setTimeout(() => {
            this.refreshStreamsBarComponentsForNewViews();
            this.isInitializing = false;
        }, TIMING.INITIALIZATION_DELAY);

        this.initialized = true;
    }

    private initializeServices(): void {
        const plugin = this.getPlugin();

        // Note: ViewManagementService and ComponentLifecycleManager are utility classes,
        // not slice services, so they are instantiated directly rather than accessed via service registry
        this.viewManagementService = new ViewManagementService(
            plugin.app,
            () => this.getStreams(),
            () => this.getDefaultStream(),
            (stream) => this.getDefaultFilePath(stream)
        );

        this.componentLifecycleManager = new ComponentLifecycleManager(
            plugin.app,
            () => this.getStreams(),
            () => this.getActiveStream(),
            () => this.getSettings(),
            () => this.getPlugin()
        );
    }

    cleanup(): void {
        if (this.componentLifecycleManager) {
            this.componentLifecycleManager.removeAllComponents();
        }
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

    onSettingsChanged(settings: StreamsSettings): void {
        // Update existing components with new settings
        this.updateExistingComponentsSettings(settings);
        
        // Also refresh components for new views
        this.updateAllStreamsBarComponents();
    }

    private registerCleanupTasks(): void {
        // Register cleanup task for memory management
        registerCleanupTask(() => {
            if (this.componentLifecycleManager) {
                this.componentLifecycleManager.removeAllComponents();
            }
        });
    }


    private registerEventHandlers(): void {
        const plugin = this.getPlugin();

        // Handle active leaf changes - only ensure component exists, don't recreate unnecessarily
        plugin.registerEvent(
            plugin.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf && this.viewManagementService?.isMainEditorLeaf(leaf)) {
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
                    setTimeout(async () => {
                        await this.ensureStreamsBarComponentForFile(file.path);
                    }, TIMING.STANDARD_DELAY);
                }
            })
        );

        // Update calendar when create file view is opened
        eventBus.subscribe('create-file-view-opened', (event) => {
            if (event.data) {
                this.updateStreamsBarComponent(event.data);
            }
        });

        // Update calendar when install meld view is opened
        eventBus.subscribe('install-meld-view-opened', (event) => {
            if (event.data) {
                this.updateStreamsBarComponent(event.data);
            }
        });

        // Update calendar when create file view encrypted is opened
        eventBus.subscribe('create-file-view-encrypted-opened', (event) => {
            if (event.data) {
                this.updateStreamsBarComponent(event.data);
            }
        });
    }

    private registerPluginViews(): void {
        const plugin = this.getPlugin();
        
        if (this.viewManagementService) {
            this.viewManagementService.registerPluginViews((viewType, viewCreator) => {
                plugin.registerView(viewType, viewCreator);
            });
        }
    }

    public updateStreamsBarComponent(leaf: WorkspaceLeaf): void {
        // Only create calendar components for leaves in the main editor area
        if (!this.viewManagementService?.isMainEditorLeaf(leaf)) {
            return;
        }

        const settings = this.getSettings();
        if (!settings.showStreamsBarComponent) {
            if (this.componentLifecycleManager) {
                this.componentLifecycleManager.removeAllComponents();
            }
            return;
        }

        const viewType = leaf.view.getViewType();
        
        // Handle all editor view types that should have calendar components
        if (!this.viewManagementService?.shouldCreateCalendarForViewType(viewType)) {
            return;
        }

        // Get active stream or default stream
        const streamToUse = this.componentLifecycleManager?.getStreamToUse();
        if (!streamToUse) {
            return;
        }

        // Create calendar component for this leaf
        if (this.componentLifecycleManager) {
            this.componentLifecycleManager.createComponentForLeaf(leaf, streamToUse);
        }
    }


    public updateAllStreamsBarComponents = measurePerformance((): void => {
        if (this.isInitializing) return;
        
        this.refreshStreamsBarComponentsForNewViews();
    }, 'calendar-navigation', 'updateAllStreamsBarComponents');

    public refreshAllStreamsBarComponents(): void {
        this.refreshStreamsBarComponentsForNewViews();
    }

    private updateExistingComponentsSettings(settings: StreamsSettings): void {
        if (this.componentLifecycleManager) {
            this.componentLifecycleManager.updateExistingComponentsSettings(settings);
        }
    }

    private refreshStreamsBarComponentsForNewViews(): void {
        if (!this.viewManagementService || !this.componentLifecycleManager) {
            return;
        }

        // Get all leaves in the main editor area
        const allLeaves = this.getPlugin().app.workspace.getLeavesOfType('empty');
        const markdownLeaves = this.getPlugin().app.workspace.getLeavesOfType('markdown');
        const createFileLeaves = this.getPlugin().app.workspace.getLeavesOfType(CREATE_FILE_VIEW_TYPE);
        
        // Combine all editor leaves
        const allEditorLeaves = [...allLeaves, ...markdownLeaves, ...createFileLeaves];

        // Also check the active leaf specifically
        const activeLeaf = this.getPlugin().app.workspace.activeLeaf;
        if (activeLeaf && this.viewManagementService.isMainEditorLeaf(activeLeaf)) {
            this.ensureStreamsBarComponentForLeaf(activeLeaf);
        }
        
        // Process all editor leaves, but only if they're in the main editor area
        allEditorLeaves.forEach(leaf => {
            if (this.viewManagementService?.isMainEditorLeaf(leaf)) {
                this.ensureStreamsBarComponentForLeaf(leaf);
            }
        });
    }

    private async ensureStreamsBarComponentForFile(filePath: string): Promise<void> {
        const activeLeaf = this.getPlugin().app.workspace.activeLeaf;
        if (activeLeaf && this.componentLifecycleManager) {
            this.ensureStreamsBarComponentForLeaf(activeLeaf);
            await this.componentLifecycleManager.ensureComponentForFile(filePath, activeLeaf);
        }
    }

    private ensureStreamsBarComponentForLeaf(leaf: WorkspaceLeaf): void {
        if (!this.componentLifecycleManager || !this.viewManagementService) {
            return;
        }

        // Check if this leaf already has a component
        if (this.componentLifecycleManager.hasComponentForLeaf(leaf)) {
            return;
        }

        // Only create component if settings allow it
        const settings = this.getSettings();
        if (!settings.showStreamsBarComponent) {
            return;
        }

        // Get active stream or default stream
        const streamToUse = this.componentLifecycleManager.getStreamToUse();
        if (!streamToUse) {
            return;
        }

        // Create component for this leaf
        this.componentLifecycleManager.createComponentForLeaf(leaf, streamToUse);
    }

    private getStreams(): Stream[] {
        const plugin = this.getPlugin();
        return plugin.settings?.streams || [];
    }

    private getActiveStream(): Stream | undefined {
        const plugin = this.getPlugin();
        const activeStreamId = plugin.settings?.activeStreamId;
        if (!activeStreamId) return undefined;
        const streams = this.getStreams();
        return streams.find(s => s.id === activeStreamId);
    }

    private getDefaultStream(): Stream {
        // Get the first available stream or create a default one
        const streams = this.getStreams();
        
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
            encryptThisStream: false,
            disabled: false
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

}