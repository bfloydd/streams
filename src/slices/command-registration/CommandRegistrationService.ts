import { PluginAwareSliceService } from '../../shared/base-slice';
import { CommandService } from '../../shared/interfaces';
import { StreamManagementService } from '../stream-management/StreamManagementService';

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
        // No stream commands currently registered
    }


    private getStreamService(): StreamManagementService | undefined {
        return this.getService('stream-management') as StreamManagementService;
    }

    private getService(serviceName: string): any {
        const container = (this.getPlugin() as any).sliceContainer;
        if (container) {
            return container.get(serviceName);
        }
        return undefined;
    }
}
