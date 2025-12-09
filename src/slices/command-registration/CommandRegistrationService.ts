import { PluginAwareSliceService } from '../../shared/BaseSlice';
import { CommandService, ServiceContainer, LogProvider } from '../../shared/interfaces';
import { StreamManagementService } from '../stream-management/StreamManagementService';
import { StreamsAPI } from '../api/StreamsAPI';

export class CommandRegistrationService extends PluginAwareSliceService implements CommandService {
    private registeredCommands: string[] = [];

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.registerCommands();

        this.initialized = true;
    }

    cleanup(): void {
        this.unregisterCommands();
        this.initialized = false;
    }

    registerCommands(): void {
        const plugin = this.getPlugin();

        // Register stream management commands
        this.registerStreamCommands(plugin);
    }

    unregisterCommands(): void {
        // Commands are automatically unregistered when the plugin unloads
        this.registeredCommands = [];
    }


    private registerStreamCommands(plugin: any): void {
        // Debug commands removed as updateStreamBarFromFile is deprecated
    }


    private getStreamService(): StreamManagementService | undefined {
        return this.getService('stream-management') as StreamManagementService;
    }

    private getService(serviceName: string): unknown {
        const serviceContainer = this.getServiceContainer();
        return serviceContainer.sliceContainer?.get(serviceName);
    }



}
