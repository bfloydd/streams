import { App, TFile } from 'obsidian';
import { FileCreationInterface } from './FileCreationStrategy';
import { centralizedLogger } from '../../../shared/centralized-logger';

/**
 * Strategy for creating normal (unencrypted) files
 */
export class NormalFileStrategy implements FileCreationInterface {
    async createFile(app: App, filePath: string, content: string): Promise<TFile | null> {
        try {
            // Ensure the folder exists
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
                await app.vault.createFolder(folderPath);
            }
            
            // Create the file
            const file = await app.vault.create(filePath, content);
            
            if (file instanceof TFile) {
                return file;
            } else {
                centralizedLogger.error(`Failed to create normal file: ${filePath} - result is not a TFile`);
                return null;
            }
        } catch (error) {
            centralizedLogger.error(`Error creating normal file ${filePath}:`, error);
            return null;
        }
    }
    
    getStrategyName(): string {
        return 'NormalFile';
    }
}
