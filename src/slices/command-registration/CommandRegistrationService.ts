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
        // Debug command for updateStreamBarFromFile functionality
        plugin.addCommand({
            id: 'streams-debug-update-stream-bar',
            name: 'Debug: Update Stream Bar from File',
            callback: async () => {
                await this.testUpdateStreamBarFromFile();
            }
        });
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

    private async testUpdateStreamBarFromFile(): Promise<void> {
        const plugin = this.getPlugin() as any;
        const apiService = this.getService('api');
        
        if (!apiService) {
            plugin.log?.error('API service not available for testing');
            return;
        }

        // Get the first available stream for testing
        const streams = apiService.getStreams();
        if (streams.length === 0) {
            plugin.log?.warn('No streams available for testing');
            return;
        }

        const testStream = streams[0];
        const testFilePath = `${testStream.folder}/2024-01-15.md`; // Example file path
        
        plugin.log?.info(`Testing updateStreamBarFromFile for file: ${testFilePath}`);
        plugin.log?.info(`Expected stream: ${testStream.name} (${testStream.id})`);
        
        // Test the updateStreamBarFromFile method
        const result = await apiService.updateStreamBarFromFile(testFilePath);
        
        if (result) {
            plugin.log?.info('✅ updateStreamBarFromFile test PASSED - Stream bar updated successfully');
            
            // Verify the update by checking the active stream
            const activeStream = apiService.getActiveStream();
            if (activeStream && activeStream.id === testStream.id) {
                plugin.log?.info(`✅ Verification PASSED - Stream bar now shows: ${activeStream.name}`);
            } else {
                plugin.log?.warn('⚠️ Verification FAILED - Stream bar not updated correctly');
            }
        } else {
            plugin.log?.error('❌ updateStreamBarFromFile test FAILED - Method returned false');
        }
    }
}
