import { WorkspaceLeaf } from 'obsidian';
import { BaseSliceService } from '../../shared/BaseSlice';
import { ViewRegistrationService } from './ViewRegistrationService';

/**
 * Coordinator for view registration functionality
 * Handles the registration of plugin views with Obsidian
 */
export class ViewCoordinator extends BaseSliceService {
    private viewRegistrationService: ViewRegistrationService | null = null;

    setViewRegistrationService(service: ViewRegistrationService): void {
        this.viewRegistrationService = service;
    }

    registerPluginViews(registerView: (viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any) => void): void {
        if (this.viewRegistrationService) {
            this.viewRegistrationService.registerPluginViews({
                registerView: (viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any) => {
                    registerView(viewType, viewCreator);
                }
            });
        }
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
    }

    cleanup(): void {
        this.initialized = false;
    }
}
