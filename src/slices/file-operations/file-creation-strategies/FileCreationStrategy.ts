import { App, TFile } from 'obsidian';

/**
 * Interface for file creation strategies
 */
export interface FileCreationInterface {
    /**
     * Create a file using the specific strategy
     * @param app - The Obsidian app instance
     * @param filePath - The path where the file should be created
     * @param content - The initial content for the file
     * @returns The created TFile or null if creation failed
     */
    createFile(app: App, filePath: string, content: string): Promise<TFile | null>;
    
    /**
     * Get the name of this strategy
     * @returns The strategy name
     */
    getStrategyName(): string;
}
