import { App, TFile } from 'obsidian';
import { Stream } from '../../shared/types';
import { encryptionDetectionService } from '../../shared/EncryptionDetectionService';
import { configurationService } from '../../shared/ConfigurationService';
import { MeldDetectionService } from '../meld-integration';
import { centralizedLogger } from '../../shared/CentralizedLogger';

/**
 * Content indicator for calendar day display
 */
export interface ContentIndicator {
    exists: boolean;
    size: 'small' | 'medium' | 'large';
    isEncrypted?: boolean;
    isLocked?: boolean;
}

/**
 * Service for checking file content and generating content indicators
 * Handles file existence, size calculation, and encryption status
 */
export class ContentIndicatorService {
    private app: App;
    private stream: Stream;
    private meldDetectionService: MeldDetectionService;

    constructor(app: App, stream: Stream, meldDetectionService: MeldDetectionService) {
        this.app = app;
        this.stream = stream;
        this.meldDetectionService = meldDetectionService;
    }

    /**
     * Get content indicator for a specific date
     * @param date - The date to check
     * @returns Promise resolving to content indicator
     */
    async getContentIndicator(date: Date): Promise<ContentIndicator> {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const fileName = `${year}-${month}-${day}.md`;
        
        const folderPath = this.stream.folder
            .split(/[/\\]/)
            .filter(Boolean)
            .join('/');
        
        const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
        let file = this.app.vault.getAbstractFileByPath(filePath);
        let isEncrypted = false;

        // If file not found, check for encrypted version (.mdenc)
        if (!file) {
            const encryptedFilePath = filePath.replace(/\.md$/, '.mdenc');
            file = this.app.vault.getAbstractFileByPath(encryptedFilePath);
            isEncrypted = true;
        }

        if (!(file instanceof TFile)) {
            return { exists: false, size: 'small' };
        }

        // Check if file is encrypted by extension or content
        if (!isEncrypted) {
            isEncrypted = encryptionDetectionService.isEncryptedFileByPath(file.path) || 
                         await encryptionDetectionService.isFileEncrypted(this.app, file);
        }

        const fileSize = file.stat.size;
        const fileSizeConfig = configurationService.getFileSizeConfig();
        const size = fileSize < fileSizeConfig.SMALL_THRESHOLD ? 'small' :
                    fileSize < fileSizeConfig.MEDIUM_THRESHOLD ? 'medium' : 'large';

        // Determine if encrypted file is locked or unlocked
        let isLocked = false;
        if (isEncrypted) {
            isLocked = await this.isEncryptedFileLocked(file);
        }

        return { 
            exists: true, 
            size, 
            isEncrypted, 
            isLocked 
        };
    }

    /**
     * Check if an encrypted file is currently locked (requires decryption to access)
     */
    private async isEncryptedFileLocked(file: TFile): Promise<boolean> {
        try {
            // Check if Meld plugin is available
            if (!this.meldDetectionService.isMeldPluginAvailable()) {
                // If Meld is not available, consider the file locked
                return true;
            }

            // Try to read the file content to see if it's accessible
            const content = await this.app.vault.cachedRead(file);
            
            // If we can read the content and it's not encrypted patterns, it's unlocked
            if (content && !encryptionDetectionService.isEncryptedContent(content)) {
                return false;
            }

            // If content contains encrypted patterns, it's locked
            return encryptionDetectionService.isEncryptedContent(content);
        } catch (error) {
            // If we can't read the file, consider it locked
            centralizedLogger.debug('Could not read encrypted file, considering it locked:', error);
            return true;
        }
    }
}

