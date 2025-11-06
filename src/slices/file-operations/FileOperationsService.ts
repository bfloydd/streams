import { App, TFile, WorkspaceLeaf } from 'obsidian';
import { PluginAwareSliceService } from '../../shared/base-slice';
import { CommandService, ViewService } from '../../shared/interfaces';
import { OpenStreamDateCommand } from './OpenStreamDateCommand';
import { OpenTodayStreamCommand } from './OpenTodayStreamCommand';
import { OpenTodayCurrentStreamCommand } from './OpenTodayCurrentStreamCommand';
import { CreateFileView, CREATE_FILE_VIEW_TYPE } from './CreateFileView';
import { InstallMeldView, INSTALL_MELD_VIEW_TYPE } from './InstallMeldView';
import { FileCreationInterface, NormalFileStrategy, MeldEncryptedFileStrategy } from './file-creation-strategies';
import { MeldDetectionService } from '../meld-integration';
import { centralizedLogger } from '../../shared/centralized-logger';
import { encryptionDetectionService } from '../../shared/encryption-detection-service';

export class FileOperationsService extends PluginAwareSliceService implements CommandService, ViewService {
    private registeredCommands: string[] = [];
    private meldDetectionService: MeldDetectionService;
    private normalFileStrategy: FileCreationInterface;
    private meldEncryptedFileStrategy: FileCreationInterface;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize strategies
        this.meldDetectionService = new MeldDetectionService();
        this.meldDetectionService.setPlugin(this.getPlugin());
        await this.meldDetectionService.initialize();
        
        this.normalFileStrategy = new NormalFileStrategy();
        this.meldEncryptedFileStrategy = new MeldEncryptedFileStrategy();

        this.registerViews();
        this.registerCommands();

        this.initialized = true;
    }

    cleanup(): void {
        this.unregisterCommands();
        this.unregisterViews();
        
        // Cleanup Meld detection service
        if (this.meldDetectionService) {
            this.meldDetectionService.cleanup();
        }
        
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
            name: 'Open today for current stream',
            callback: () => {
                const command = new OpenTodayCurrentStreamCommand(
                    plugin.app, 
                    plugin.settings?.streams || [], 
                    plugin.settings?.reuseCurrentTab || false, 
                    plugin
                );
                command.execute();
            }
        });

        this.registeredCommands.push('open-today-current-stream');
    }

    unregisterCommands(): void {
        this.registeredCommands = [];
    }

    async openStreamDate(stream: any, date: Date, reuseCurrentTab: boolean = false): Promise<void> {
        const command = new OpenStreamDateCommand(
            this.getPlugin().app,
            stream,
            date,
            reuseCurrentTab
        );
        await command.execute();
    }

    async openTodayStream(stream: any, reuseCurrentTab: boolean = false): Promise<void> {
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
    private getFileCreationStrategy(stream: any): FileCreationInterface {
        if (stream.encryptThisStream) {
            // Check if Meld is available before using encryption strategy
            if (this.meldDetectionService.isMeldPluginAvailable()) {
                return this.meldEncryptedFileStrategy;
            } else {
                // Fall back to normal strategy if Meld is not available
                console.warn('Meld plugin not available, falling back to normal file creation');
                return this.normalFileStrategy;
            }
        }
        return this.normalFileStrategy;
    }
    
    /**
     * Create a file using the appropriate strategy
     */
    async createFile(filePath: string, content: string, stream: any): Promise<any> {
        const strategy = this.getFileCreationStrategy(stream);
        return await strategy.createFile(this.getPlugin().app, filePath, content);
    }
    
    /**
     * Check if Meld plugin is available
     */
    isMeldPluginAvailable(): boolean {
        return this.meldDetectionService?.isMeldPluginAvailable() || false;
    }
    
    /**
     * Get Meld unavailable message
     */
    getMeldUnavailableMessage(): string {
        return this.meldDetectionService?.getMeldUnavailableMessage() || 'Meld plugin is not available';
    }


    /**
     * Check if file content appears to be encrypted
     * @deprecated Use encryptionDetectionService.isEncryptedContent() instead
     */
    public isEncryptedContent(content: string): boolean {
        return encryptionDetectionService.isEncryptedContent(content);
    }
}
