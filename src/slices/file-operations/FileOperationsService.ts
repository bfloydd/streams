import { TFile } from 'obsidian';
import { PluginAwareSliceService } from '../../shared/BaseSlice';
import { CommandService, ViewService } from '../../shared/interfaces';
import { Stream } from '../../shared/types';
import { OpenStreamDateCommand } from './OpenStreamDateCommand';
import { OpenTodayStreamCommand } from './OpenTodayStreamCommand';
import { OpenTodayPrimaryStreamCommand } from './OpenTodayPrimaryStreamCommand';
import { FileCreationInterface, NormalFileStrategy, MeldEncryptedFileStrategy } from './file-creation-strategies';

export class FileOperationsService extends PluginAwareSliceService implements CommandService, ViewService {
    private registeredCommands: string[] = [];
    private normalFileStrategy: FileCreationInterface;
    private meldEncryptedFileStrategy: FileCreationInterface;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize strategies
        this.normalFileStrategy = new NormalFileStrategy();
        this.meldEncryptedFileStrategy = new MeldEncryptedFileStrategy();

        this.registerViews();
        this.registerCommands();

        this.initialized = true;
    }

    cleanup(): void {
        this.unregisterCommands();
        this.unregisterViews();
        this.initialized = false;
    }

    registerViews(): void {
        // Views are now registered directly in the main plugin
    }

    unregisterViews(): void {
    }

    registerCommands(): void {
        const plugin = this.getPlugin();
        
        plugin.addCommand({
            id: 'open-today-current-stream',
            name: 'Go to primary stream',
            callback: () => {
                const command = new OpenTodayPrimaryStreamCommand(
                    plugin.app,
                    plugin.settings?.streams || [],
                    plugin,
                    plugin.settings?.reuseCurrentTab || false
                );
                command.execute();
            }
        });

        this.registeredCommands.push('open-today-current-stream');
    }

    unregisterCommands(): void {
        this.registeredCommands = [];
    }

    async openStreamDate(stream: Stream, date: Date, reuseCurrentTab = false): Promise<void> {
        const command = new OpenStreamDateCommand(
            this.getPlugin().app,
            stream,
            date,
            reuseCurrentTab
        );
        await command.execute();
    }

    async openTodayStream(stream: Stream, reuseCurrentTab = false): Promise<void> {
        const command = new OpenTodayStreamCommand(
            this.getPlugin().app,
            stream,
            reuseCurrentTab
        );
        await command.execute();
    }

    
    /**
     * Get the appropriate file creation strategy for a stream
     */
    private getFileCreationStrategy(stream: Stream): FileCreationInterface {
        if (stream.encryptThisStream) {
            // Check if Meld is available before using encryption strategy
            // Note: Meld detection is now handled by the meld-integration service
            // For now, assume Meld is available if encryption is requested
            return this.meldEncryptedFileStrategy;
        }
        return this.normalFileStrategy;
    }
    
    /**
     * Create a file using the appropriate strategy
     */
    async createFile(filePath: string, content: string, stream: Stream): Promise<TFile | null> {
        const strategy = this.getFileCreationStrategy(stream);
        return await strategy.createFile(this.getPlugin().app, filePath, content);
    }
    


}
