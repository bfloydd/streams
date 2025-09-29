import { PluginAwareSliceService } from '../../shared/base-slice';
import { CommandService } from '../../shared/interfaces';
import { DebugLoggingService } from '../debug-logging/DebugLoggingService';
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
        
        // Register debug logging commands
        this.registerDebugCommands(plugin);
        
        // Register stream management commands
        this.registerStreamCommands(plugin);
        
        // Register utility commands
        this.registerUtilityCommands(plugin);
    }

    unregisterCommands(): void {
        // Commands are automatically unregistered when the plugin unloads
        this.registeredCommands = [];
    }

    private registerDebugCommands(plugin: any): void {
        // Toggle debug logging command
        plugin.addCommand({
            id: 'streams-toggle-debug-logging',
            name: 'Toggle debug logging',
            callback: () => {
                const debugService = this.getDebugService();
                if (debugService) {
                    const command = debugService.createToggleCommand();
                    command.execute();
                }
            }
        });

        this.registeredCommands.push('streams-toggle-debug-logging');
    }

    private registerStreamCommands(plugin: any): void {
        // Stream selection command
        plugin.addCommand({
            id: 'streams-select-stream',
            name: 'Select active stream',
            callback: () => {
                const streamService = this.getStreamService();
                if (streamService) {
                    streamService.showStreamSelection();
                }
            }
        });

        // Refresh global indicator command
        plugin.addCommand({
            id: 'streams-refresh-global-indicator',
            name: 'Refresh global stream indicator',
            callback: () => {
                const streamService = this.getStreamService();
                if (streamService) {
                    // This will trigger the update
                    streamService.getActiveStream();
                }
            }
        });

        this.registeredCommands.push('streams-select-stream', 'streams-refresh-global-indicator');
    }

    private registerUtilityCommands(plugin: any): void {
        // Show active stream info command
        plugin.addCommand({
            id: 'streams-show-active-stream',
            name: 'Show active stream info',
            callback: () => {
                const streamService = this.getStreamService();
                if (streamService) {
                    const activeStream = streamService.getActiveStream();
                    if (activeStream) {
                        plugin.app.notifications.show(`Active stream: ${activeStream.name}`);
                    } else {
                        plugin.app.notifications.show('No active stream');
                    }
                }
            }
        });

        // Toggle streams bar component command
        plugin.addCommand({
            id: 'streams-toggle-calendar',
            name: 'Toggle streams bar component',
            callback: () => {
                const settings = plugin.settings;
                settings.showStreamsBarComponent = !settings.showStreamsBarComponent;
                plugin.saveSettings();
                
                // Refresh streams bar components
                const calendarService = this.getCalendarService();
                if (calendarService) {
                    calendarService.refreshAllStreamsBarComponents();
                }
                
                plugin.app.notifications.show(`Streams bar component ${settings.showStreamsBarComponent ? 'shown' : 'hidden'}`);
            }
        });

        this.registeredCommands.push('streams-show-active-stream', 'streams-toggle-calendar');
    }

    private getDebugService(): DebugLoggingService | undefined {
        return this.getService('debug-logging') as DebugLoggingService;
    }

    private getStreamService(): StreamManagementService | undefined {
        return this.getService('stream-management') as StreamManagementService;
    }

    private getCalendarService(): any {
        return this.getService('calendar-navigation');
    }

    private getService(serviceName: string): any {
        const container = (this.getPlugin() as any).sliceContainer;
        if (container) {
            return container.get(serviceName);
        }
        return undefined;
    }
}
