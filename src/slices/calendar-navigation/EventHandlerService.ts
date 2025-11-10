import { App, WorkspaceLeaf } from 'obsidian';
import { INSTALL_MELD_VIEW_TYPE } from '../file-operations/InstallMeldView';
import { CREATE_FILE_VIEW_ENCRYPTED_TYPE } from '../file-operations/CreateFileViewEncrypted';
import { configurationService } from '../../shared/ConfigurationService';
import { eventBus, EVENTS } from '../../shared/EventBus';
import { centralizedLogger } from '../../shared/CentralizedLogger';

/**
 * Handles all event registrations and subscriptions for calendar navigation
 * Extracted from CalendarNavigationService to follow Single Responsibility Principle
 */
export class EventHandlerService {
    private app: App;
    private componentLifecycleManager: any; // Will be injected
    private leafInspectionService: any; // Will be injected

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Set dependencies after construction to avoid circular dependencies
     */
    setDependencies(componentLifecycleManager: any, leafInspectionService: any): void {
        this.componentLifecycleManager = componentLifecycleManager;
        this.leafInspectionService = leafInspectionService;
    }

    /**
     * Register all workspace and plugin events
     */
    registerEvents(plugin: any): void {
        this.registerWorkspaceEvents(plugin);
        this.registerEventBusListeners();
    }

    /**
     * Register workspace events (active-leaf-change, layout-change, etc.)
     */
    private registerWorkspaceEvents(plugin: any): void {
        // Handle active leaf changes - only ensure component exists, don't recreate unnecessarily
        plugin.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf && this.leafInspectionService?.isMainEditorLeaf(leaf)) {
                    this.handleActiveLeafChange(leaf);
                }
            })
        );

        // Handle new leaves being created (new tabs opened) and layout changes
        plugin.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.handleLayoutChange();
            })
        );

        // Handle when leaves become visible (e.g., when switching between split views)
        plugin.registerEvent(
            this.app.workspace.on('resize', () => {
                this.handleLayoutChange();
            })
        );

        // Handle file open events to ensure calendar components are created
        plugin.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file) {
                    setTimeout(async () => {
                        await this.handleFileOpen(file.path);
                    }, configurationService.getTimingConfig().STANDARD_DELAY);
                }
            })
        );
    }

    /**
     * Register event bus listeners
     */
    private registerEventBusListeners(): void {
        // Listen for stream changes
        eventBus.subscribe(EVENTS.STREAM_ADDED, () => this.handleStreamChange());
        eventBus.subscribe(EVENTS.STREAM_UPDATED, () => this.handleStreamChange());
        eventBus.subscribe(EVENTS.STREAM_REMOVED, () => this.handleStreamChange());
        eventBus.subscribe(EVENTS.ACTIVE_STREAM_CHANGED, () => this.handleStreamChange());

        // Listen for create file view opened
        eventBus.subscribe('create-file-view-opened', (event) => {
            if (event.data) {
                this.handleViewOpened(event.data);
            }
        });

        // Listen for install meld view opened
        eventBus.subscribe('install-meld-view-opened', (event) => {
            if (event.data) {
                this.handleViewOpened(event.data);
            }
        });

        // Listen for create file view encrypted opened
        eventBus.subscribe('create-file-view-encrypted-opened', (event) => {
            if (event.data) {
                this.handleViewOpened(event.data);
            }
        });
    }

    /**
     * Handle active leaf change event
     */
    private handleActiveLeafChange(leaf: WorkspaceLeaf): void {
        if (this.componentLifecycleManager) {
            this.componentLifecycleManager.ensureStreamsBarComponentForLeaf(leaf);
        }
    }

    /**
     * Handle layout change or resize events
     */
    private handleLayoutChange(): void {
        if (this.componentLifecycleManager) {
            this.componentLifecycleManager.refreshStreamsBarComponentsForNewViews();
        }
    }

    /**
     * Handle file open event
     */
    private async handleFileOpen(filePath: string): Promise<void> {
        if (this.componentLifecycleManager) {
            const activeLeaf = this.app.workspace.activeLeaf;
            if (activeLeaf) {
                this.componentLifecycleManager.ensureStreamsBarComponentForLeaf(activeLeaf);
                await this.componentLifecycleManager.ensureComponentForFile(filePath, activeLeaf);
            }
        }
    }

    /**
     * Handle stream change events
     */
    private handleStreamChange(): void {
        if (this.componentLifecycleManager) {
            this.componentLifecycleManager.updateAllStreamsBarComponents();
        }
    }

    /**
     * Handle view opened events
     */
    private handleViewOpened(leaf: WorkspaceLeaf): void {
        if (this.componentLifecycleManager) {
            this.componentLifecycleManager.updateStreamsBarComponent(leaf);
        }
    }

    /**
     * Cleanup event handlers
     */
    cleanup(): void {
        // Event cleanup is handled by plugin.registerEvent() automatically
        // No manual cleanup needed for event bus subscriptions
    }
}
