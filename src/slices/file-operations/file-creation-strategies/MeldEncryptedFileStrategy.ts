import { App, TFile } from 'obsidian';
import { FileCreationInterface } from './FileCreationStrategy';
import { centralizedLogger } from '../../../shared/centralized-logger';

/**
 * Strategy for creating encrypted files using Meld plugin
 */
export class MeldEncryptedFileStrategy implements FileCreationInterface {
    private meldCommandId = 'meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note';
    
    async createFile(app: App, filePath: string, content: string): Promise<TFile | null> {
        try {
            // Ensure the folder exists
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
                await app.vault.createFolder(folderPath);
            }
            
            // First create the file normally
            const file = await app.vault.create(filePath, content);
            
            if (!(file instanceof TFile)) {
                centralizedLogger.error(`Failed to create file before encryption: ${filePath} - result is not a TFile`);
                return null;
            }
            
            // Then encrypt it using Meld plugin
            await this.encryptFile(app, file);
            
            return file;
        } catch (error) {
            centralizedLogger.error(`Error creating encrypted file ${filePath}:`, error);
            return null;
        }
    }
    
    private async encryptFile(app: App, file: TFile): Promise<void> {
        try {
            // Check if Meld plugin is available
            if (!this.isMeldPluginAvailable(app)) {
                throw new Error('Meld plugin is not available or not enabled');
            }
            
            // Get the Meld plugin instance
            const meldPlugin = (app as any).plugins?.plugins?.['meld-encrypt'];
            if (!meldPlugin) {
                throw new Error('Meld plugin instance not found');
            }
            
            // Try to call the encryption method directly on the plugin
            if (meldPlugin.encryptFile && typeof meldPlugin.encryptFile === 'function') {
                await meldPlugin.encryptFile(file);
                return;
            }
            
            // Try to call encryption with file path parameter
            if (meldPlugin.encryptFileByPath && typeof meldPlugin.encryptFileByPath === 'function') {
                await meldPlugin.encryptFileByPath(file.path);
                return;
            }
            
            // Fallback: Use command execution
            const command = (app as any).commands?.commands?.[this.meldCommandId];
            if (command) {
                if (command.callback.length > 0) {
                    // Command accepts parameters
                    await command.callback(file.path);
                } else {
                    // Command needs active file context
                    const activeLeaf = app.workspace.activeLeaf;
                    let fileLeaf = null;
                    
                    try {
                        // Find or create a leaf with the file
                        const existingLeaf = app.workspace.getLeavesOfType('markdown')
                            .find(leaf => {
                                try {
                                    const view = leaf.view as any;
                                    return view?.file?.path === file.path;
                                } catch (e) {
                                    return false;
                                }
                            });
                        
                        if (existingLeaf) {
                            fileLeaf = existingLeaf;
                        } else {
                            fileLeaf = app.workspace.getLeaf('tab');
                            await fileLeaf.openFile(file);
                        }
                        
                        // Set as active leaf and execute command
                        app.workspace.setActiveLeaf(fileLeaf, { focus: true });
                        await new Promise(resolve => setTimeout(resolve, 100));
                        await command.callback();
                        
                    } finally {
                        // Restore original active leaf
                        if (activeLeaf && activeLeaf !== fileLeaf) {
                            app.workspace.setActiveLeaf(activeLeaf, { focus: false });
                        }
                    }
                }
            } else {
                throw new Error(`Meld encryption command not found: ${this.meldCommandId}`);
            }
        } catch (error) {
            centralizedLogger.error(`Error encrypting file ${file.path}:`, error);
            throw error;
        }
    }
    
    private isMeldPluginAvailable(app: App): boolean {
        try {
            // Check if the Meld plugin is installed and enabled
            const plugins = (app as any).plugins?.plugins;
            if (!plugins) return false;
            
            // Check for Meld plugin
            const meldPlugin = plugins['meld-encrypt'];
            if (!meldPlugin) return false;
            
            // Check if the specific command exists
            const commands = (app as any).commands?.commands;
            if (!commands) return false;
            
            return !!commands[this.meldCommandId];
        } catch (error) {
            centralizedLogger.error('Error checking Meld plugin availability:', error);
            return false;
        }
    }
    
    getStrategyName(): string {
        return 'MeldEncryptedFile';
    }
}
