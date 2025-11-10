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
        // Debug command for updateStreamBarFromFile functionality
        plugin.addCommand({
            id: 'debug-update-stream-bar',
            name: 'Debug: Update Stream Bar from File',
            callback: async () => {
                await this.testUpdateStreamBarFromFile();
            }
        });
    }


    private getStreamService(): StreamManagementService | undefined {
        return this.getService('stream-management') as StreamManagementService;
    }

    private getService(serviceName: string): unknown {
        const serviceContainer = this.getServiceContainer();
        return serviceContainer.sliceContainer?.get(serviceName);
    }

    private async testUpdateStreamBarFromFile(): Promise<void> {
        const logProvider = this.getLogProvider();
        const apiService = this.getService('api') as StreamsAPI | undefined;

        if (!apiService) {
            logProvider.log?.error('API service not available for testing');
            return;
        }

        // Get the first available stream for testing
        const streams = apiService.getStreams();
        if (streams.length === 0) {
            logProvider.log?.warn('No streams available for testing');
            return;
        }

        const testStream = streams[0];
        const testFilePath = `${testStream.folder}/2024-01-15.md`; // Example file path

        logProvider.log?.info(`Testing updateStreamBarFromFile for file: ${testFilePath}`);
        logProvider.log?.info(`Expected stream: ${testStream.name} (${testStream.id})`);

        // Test the updateStreamBarFromFile method
        const result = await apiService.updateStreamBarFromFile(testFilePath);

        if (result) {
            logProvider.log?.info('✅ updateStreamBarFromFile test PASSED - Stream bar updated successfully');

            // Verify the update by checking the active stream
            const activeStream = apiService.getActiveStream();
            if (activeStream && activeStream.id === testStream.id) {
                logProvider.log?.info(`✅ Verification PASSED - Stream bar now shows: ${activeStream.name}`);
            } else {
                logProvider.log?.warn('⚠️ Verification FAILED - Stream bar not updated correctly');
            }
        } else {
            logProvider.log?.error('❌ updateStreamBarFromFile test FAILED - Method returned false');
        }
    }
}
