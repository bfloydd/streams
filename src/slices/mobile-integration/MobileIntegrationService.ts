import { App, Platform } from 'obsidian';
import { PluginAwareSliceService } from '../../shared/base-slice';
import { StreamManagementService } from '../stream-management/StreamManagementService';

export class MobileIntegrationService extends PluginAwareSliceService {
    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.initializeMobileIntegration();

        this.initialized = true;
    }

    cleanup(): void {
        // Mobile integration cleanup is handled by Obsidian's event system
        this.initialized = false;
    }

    private initializeMobileIntegration(): void {
        // Add share handler for Android
        if (Platform.isAndroidApp) {
            const plugin = this.getPlugin();
            
            plugin.registerEvent(
                plugin.app.workspace.on('file-menu', (menu, file) => {
                    if (file && this.hasStreams()) {
                        menu.addItem((item) => {
                            item
                                .setTitle('Insert link into stream')
                                .setIcon('link')
                                .onClick(async () => {
                                    await this.showStreamSelectionModal(file.path);
                                });
                        });
                    }
                })
            );
        }
    }

    private async showStreamSelectionModal(filePath: string): Promise<void> {
        const streamService = this.getStreamManagementService();
        if (streamService) {
            // Use the stream management service to show selection
            streamService.showStreamSelection();
        }
    }

    private hasStreams(): boolean {
        const plugin = this.getPlugin() as any;
        return plugin.settings?.streams?.length > 0;
    }

    private getStreamManagementService(): StreamManagementService | undefined {
        // Get the stream management service from the container
        const container = (this.getPlugin() as any).sliceContainer;
        if (container) {
            return container.get('stream-management') as StreamManagementService;
        }
        return undefined;
    }
}
