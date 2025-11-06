import { App, TFile, WorkspaceLeaf, MarkdownView, Notice } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { TIMING } from '../../shared/timing-constants';
import { getPluginById, getCommands, executeCommandById } from '../../shared/obsidian-types';
import { StreamsPluginInterface } from '../../shared/interfaces';

/**
 * Service for handling file creation and encryption operations
 * Extracted from CreateFileView to follow Single Responsibility Principle
 */
export class FileCreationService {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Create a file normally (without encryption)
     */
    async createFileNormally(filePath: string): Promise<TFile | null> {
        try {
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            
            if (folderPath) {
                try {
                    const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
                    if (!folderExists) {
                        await this.app.vault.createFolder(folderPath);
                    }
                } catch (error) {
                    // Using existing folder
                }
            }
            
            // Create the file normally (without encryption)
            const file = await this.app.vault.create(filePath, '');
            return file instanceof TFile ? file : null;
        } catch (error) {
            centralizedLogger.error('Error creating file normally:', error);
            return null;
        }
    }

    /**
     * Check if Meld is available for encryption
     */
    isMeldAvailable(stream: Stream): boolean {
        if (!stream.encryptThisStream) {
            return false;
        }

        const plugin = getPluginById(this.app, 'streams') as StreamsPluginInterface | undefined;
        if (!plugin) {
            return false;
        }

        const fileOpsService = plugin.getFileOperationsService?.();
        return fileOpsService?.isMeldPluginAvailable() || false;
    }

    /**
     * Get Meld unavailable message
     */
    getMeldUnavailableMessage(): string {
        const plugin = getPluginById(this.app, 'streams') as StreamsPluginInterface | undefined;
        if (!plugin) {
            return 'Meld plugin is required for encryption but is not available.';
        }

        const fileOpsService = plugin.getFileOperationsService?.();
        return fileOpsService?.getMeldUnavailableMessage() || 'Meld plugin is required for encryption but is not available.';
    }

    /**
     * Trigger encryption for a file using Meld
     */
    async triggerEncryption(file: TFile, leaf: WorkspaceLeaf): Promise<void> {
        try {
            // Ensure the file is the active file
            const activeFile = this.app.workspace.getActiveFile();
            
            if (activeFile?.path !== file.path) {
                // Find a leaf with this file and make it active
                const fileLeaf = this.app.workspace.getLeavesOfType('markdown')
                    .find(l => {
                        try {
                            const view = l.view as MarkdownView;
                            return view?.file?.path === file.path;
                        } catch (e) {
                            return false;
                        }
                    });
                
                if (fileLeaf) {
                    this.app.workspace.setActiveLeaf(fileLeaf, { focus: true });
                } else {
                    centralizedLogger.error(`Could not find leaf with file: ${file.path}`);
                    return;
                }
            }
            
            // Small delay to ensure the file is properly active
            await new Promise(resolve => setTimeout(resolve, TIMING.FILE_OPERATION_DELAY));
            
            // Try to execute the Meld encryption command
            const commands = getCommands(this.app);
            const command = commands?.['meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note'];
            
            if (command?.callback && typeof command.callback === 'function') {
                try {
                    await command.callback();
                } catch (cmdError) {
                    centralizedLogger.error(`Meld command execution failed:`, cmdError);
                }
            } else {
                // Fallback: Use command palette API
                try {
                    await executeCommandById(this.app, 'meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note');
                } catch (altError) {
                    centralizedLogger.error('Meld encryption command failed:', altError);
                }
            }
        } catch (error) {
            centralizedLogger.error(`Error triggering encryption for file ${file.path}:`, error);
        }
    }

    /**
     * Create and open a file, with optional encryption
     */
    async createAndOpenFile(
        filePath: string,
        stream: Stream,
        leaf: WorkspaceLeaf
    ): Promise<TFile | null> {
        try {
            // Check if encryption is enabled but Meld is not available
            if (stream.encryptThisStream && !this.isMeldAvailable(stream)) {
                // Show error and don't create file
                new Notice(this.getMeldUnavailableMessage());
                return null;
            }
            
            // Create the file normally first (without encryption)
            const file = await this.createFileNormally(filePath);
            
            if (file instanceof TFile) {
                // Open the file in the current leaf (this will replace CreateFileView)
                await leaf.openFile(file);
                
                // If encryption is enabled, trigger it after the file is opened
                if (stream.encryptThisStream) {
                    // Small delay to ensure the file is fully loaded
                    setTimeout(async () => {
                        await this.triggerEncryption(file, leaf);
                    }, 200);
                }
                
                return file;
            }
            
            return null;
        } catch (error) {
            centralizedLogger.error('Error creating file:', error);
            return null;
        }
    }
}

