import { App, TFile } from 'obsidian';
import { centralizedLogger } from './CentralizedLogger';

/**
 * Service for detecting encrypted file content
 * Centralizes encryption detection logic to eliminate duplication
 */
export class EncryptionDetectionService {
    private static instance: EncryptionDetectionService;
    
    private constructor() {}
    
    static getInstance(): EncryptionDetectionService {
        if (!EncryptionDetectionService.instance) {
            EncryptionDetectionService.instance = new EncryptionDetectionService();
        }
        return EncryptionDetectionService.instance;
    }
    
    /**
     * Common patterns that indicate encrypted content
     */
    private readonly encryptedPatterns = [
        /^-----BEGIN PGP MESSAGE-----/,
        /^-----BEGIN ENCRYPTED MESSAGE-----/,
        /^-----BEGIN MESSAGE-----/,
        /^U2FsdGVkX1/, // Base64 encoded encrypted content (common in some encryption tools)
        /^[A-Za-z0-9+/]{100,}={0,2}$/ // Long base64 strings (potential encrypted content)
    ];
    
    /**
     * Check if file content appears to be encrypted
     * @param content - The file content to check
     * @returns true if content matches encryption patterns
     */
    isEncryptedContent(content: string): boolean {
        return this.encryptedPatterns.some(pattern => pattern.test(content.trim()));
    }
    
    /**
     * Check if a file is encrypted by examining its content
     * @param app - Obsidian app instance
     * @param file - The file to check
     * @returns Promise resolving to true if file content is encrypted
     */
    async isFileEncrypted(app: App, file: TFile): Promise<boolean> {
        try {
            const content = await app.vault.cachedRead(file);
            return this.isEncryptedContent(content);
        } catch (error) {
            centralizedLogger.error('Error reading file content for encryption check:', error);
            return false;
        }
    }
    
    /**
     * Check if a file path indicates encryption (by extension)
     * @param filePath - The file path to check
     * @returns true if file path ends with .mdenc
     */
    isEncryptedFileByPath(filePath: string): boolean {
        return filePath.endsWith('.mdenc');
    }
    
    /**
     * Check if a file is encrypted by extension or content
     * @param app - Obsidian app instance
     * @param file - The file to check
     * @returns Promise resolving to true if file is encrypted (by path or content)
     */
    async isEncrypted(app: App, file: TFile): Promise<boolean> {
        // First check by extension
        if (this.isEncryptedFileByPath(file.path)) {
            return true;
        }
        
        // Then check content
        return await this.isFileEncrypted(app, file);
    }
}

/**
 * Singleton instance for easy access
 */
export const encryptionDetectionService = EncryptionDetectionService.getInstance();

