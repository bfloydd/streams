import { App, TFolder, TFile, MarkdownView, WorkspaceLeaf, normalizePath } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { CreateFileView, CREATE_FILE_VIEW_TYPE } from './CreateFileView';
import { DateStateManager } from '../../shared/date-state-manager';

/**
 * Interface for Obsidian's internal ViewRegistry, which manages all view registrations
 */
interface ViewRegistry {
    /**
     * Register a view creator function for a given view type
     */
    registerView(viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any): void;
    
    /**
     * Get a view creator function for a given view type
     */
    getViewCreatorByType(viewType: string): ((leaf: WorkspaceLeaf) => any) | null;
}

/**
 * Interface for Obsidian's App with internal ViewRegistry
 */
interface AppWithViewRegistry extends App {
    viewRegistry: ViewRegistry;
}



/**
 * Normalize folder path - uses Obsidian's normalizePath and filters out empty segments
 */
export function normalizeFolderPath(folder: string): string {
    const normalized = normalizePath(folder);
    return normalized
        .split('/')
        .filter(Boolean)
        .join('/');
}

/**
 * Formats a date as YYYY-MM-DD for filenames
 */
export function formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getFolderSuggestions(app: App): string[] {
    const folders: string[] = [];
    
    function recurseFolder(folder: TFolder, path: string = '') {
        const folderPath = path ? `${path}/${folder.name}` : folder.name;
        folders.push(folderPath);
        
        folder.children.forEach(child => {
            if (child instanceof TFolder) {
                recurseFolder(child, folderPath);
            }
        });
    }

    app.vault.getAllLoadedFiles().forEach(file => {
        if (file instanceof TFolder) {
            recurseFolder(file);
        }
    });

    return folders;
}

export async function createDailyNote(app: App, folder: string): Promise<TFile | null> {
    const date = new Date();
    const fileName = `${formatDateToYYYYMMDD(date)}.md`;

    const folderPath = normalizeFolderPath(folder);
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    let file = app.vault.getAbstractFileByPath(filePath);
    
    if (!file) {
        if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
            await app.vault.createFolder(folderPath);
        }
        
        const template = '';  
        file = await app.vault.create(filePath, template);
    }

    return file instanceof TFile ? file : null;
}

export async function openStreamDate(app: App, stream: Stream, date: Date = new Date(), reuseCurrentTab: boolean = false): Promise<void> {
	// Opening stream date
    
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        centralizedLogger.error(`Invalid date provided: ${date}`);
        return;
    }
    
    const fileName = `${formatDateToYYYYMMDD(date)}.md`;
    // Formatted date

    const folderPath = normalizeFolderPath(stream.folder);
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
    // Looking for file at path

    let file = app.vault.getAbstractFileByPath(filePath);
    // File exists check
    
    if (!file) {
        // File not found, showing create file view
        if (folderPath) {
            try {
                const folderExists = app.vault.getAbstractFileByPath(folderPath);
                if (!folderExists) {
                    await app.vault.createFolder(folderPath);
                    // Created folder
                }
            } catch (error) {
                // log.debug('Using existing folder:', folderPath);
            }
        }
        
        // Handle leaf selection based on reuseCurrentTab setting
        let leaf: WorkspaceLeaf | null = null;
        
        if (reuseCurrentTab) {
            // Always try to reuse the current active leaf when reuseCurrentTab is enabled
            const activeLeaf = app.workspace.activeLeaf;
            if (activeLeaf) {
                leaf = activeLeaf;
                // log.debug('Reusing current active leaf for CreateFileView (reuseCurrentTab enabled)');
            } else {
                // Fallback: create a new leaf if no active leaf
                try {
                    leaf = app.workspace.getLeaf('tab');
                } catch (error) {
                    centralizedLogger.error('Failed to create new leaf:', error);
                    return;
                }
            }
        } else {
            // Original behavior: only reuse empty/non-markdown views
            const activeLeaf = app.workspace.activeLeaf;
            if (activeLeaf && !activeLeaf.view.getViewType().includes('markdown')) {
                leaf = activeLeaf;
            } else {
                // Create a new leaf if current one is not suitable
                try {
                    leaf = app.workspace.getLeaf('tab');
                } catch (error) {
                    centralizedLogger.error('Failed to create new leaf:', error);
                    return;
                }
            }
        }
        
        // Check if leaf is null before proceeding
        if (!leaf) {
            centralizedLogger.error('Failed to create or find a workspace leaf for CreateFileView');
            return;
        }
        
        try {
            // Check if leaf is still valid
            if (!leaf || !leaf.view) {
                centralizedLogger.error(`Leaf is no longer valid, cannot set view state`);
                return;
            }
            
            // Update the date state manager to reflect the current date
            const dateStateManager = DateStateManager.getInstance();
            dateStateManager.setCurrentDate(date);
            
            // Use the proper Obsidian view system instead of direct DOM manipulation
            try {
                await leaf.setViewState({
                    type: CREATE_FILE_VIEW_TYPE,
                    state: {
                        stream: stream,
                        date: date.toISOString(),
                        filePath: filePath
                    }
                });
                centralizedLogger.debug(`Successfully set view state for CreateFileView`);
            } catch (error) {
                centralizedLogger.error(`Error setting view state for CreateFileView:`, error);
                // If setViewState fails, we can't proceed
                return;
            }
            
            // Set the active leaf
            app.workspace.setActiveLeaf(leaf, { focus: true });
            
        } catch (error) {
            centralizedLogger.error('Error setting up CreateFileView:', error);
            return;
        }
        
        return;
    }

    if (file instanceof TFile) {
        try {
            let leaf: WorkspaceLeaf | null = null;
            
            if (reuseCurrentTab) {
                // Always try to reuse the current active leaf when reuseCurrentTab is enabled
                const activeLeaf = app.workspace.activeLeaf;
                if (activeLeaf) {
                    leaf = activeLeaf;
                    // log.debug('Reusing current active leaf for markdown view (reuseCurrentTab enabled)');
                } else {
                    // Fallback: look for existing leaf with the same file
                    const existingLeaf = app.workspace.getLeavesOfType('markdown')
                        .find(leaf => {
                            try {
                                const view = leaf.view as MarkdownView;
                                const viewFile = view?.file;
                                if (!viewFile || !file) return false;
                                
                                const viewPath = normalizePath(viewFile.path);
                                const filePath = normalizePath(file.path);
                                return viewPath === filePath;
                            } catch (e) {
                                // log.debug('Error comparing files:', e);
                                return false;
                            }
                        });

                    if (existingLeaf) {
                        leaf = existingLeaf;
                        // log.debug('Found existing leaf with same file');
                    } else {
                        leaf = app.workspace.getLeaf('tab');
                        // log.debug('Created a new leaf for markdown view');
                    }
                }
            } else {
                // Original behavior: look for existing leaf with same file first
                const existingLeaf = app.workspace.getLeavesOfType('markdown')
                    .find(leaf => {
                        try {
                            const view = leaf.view as MarkdownView;
                            const viewFile = view?.file;
                            if (!viewFile || !file) return false;
                            
                            const viewPath = normalizePath(viewFile.path);
                            const filePath = normalizePath(file.path);
                            return viewPath === filePath;
                        } catch (e) {
                            // log.debug('Error comparing files:', e);
                            return false;
                        }
                    });

                if (existingLeaf) {
                    leaf = existingLeaf;
                    // log.debug('Found existing leaf with same file');
                } else {
                    leaf = app.workspace.getLeaf('tab');
                    // log.debug('Created a new leaf for markdown view');
                }
            }
            
            if (leaf) {
                await leaf.openFile(file);
                app.workspace.setActiveLeaf(leaf, { focus: true });
            }
        } catch (e) {
            centralizedLogger.error('Error opening stream date:', e);
        }
    }
} 