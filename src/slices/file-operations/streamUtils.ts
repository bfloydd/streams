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
        
        // Instead of creating a new leaf, work with the current active leaf if it's empty
        let leaf: WorkspaceLeaf | null = null;
        
        // Check if current active leaf is empty and can be used
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
        
        // Check if leaf is null before proceeding
        if (!leaf) {
            centralizedLogger.error('Failed to create or find a workspace leaf for CreateFileView');
            return;
        }
        
        try {
            // Update the date state manager to reflect the current date
            const dateStateManager = DateStateManager.getInstance();
            dateStateManager.setCurrentDate(date);
            
            // Get the leaf's container and find the view-content area
            const leafContainer = leaf.view.containerEl;
            const viewContent = leafContainer.querySelector('.view-content');
            
            if (viewContent) {
                // Clear the existing content in view-content
                viewContent.innerHTML = '';
                
                // Create our custom content directly in view-content using innerHTML
                viewContent.innerHTML = `
                    <div class="streams-create-file-container">
                        <div class="streams-create-file-content">
                            <div class="streams-create-file-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-file-plus">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                    <polyline points="14,2 14,8 20,8"></polyline>
                                    <line x1="12" y1="18" x2="12" y2="12"></line>
                                    <line x1="9" y1="15" x2="15" y2="15"></line>
                                </svg>
                            </div>
                            <div class="streams-create-file-stream-container">
                                <span class="streams-create-file-stream-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-book">
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                    </svg>
                                </span>
                                <span class="streams-create-file-stream">${stream.name}</span>
                            </div>
                            <div class="streams-create-file-date">${date.toLocaleDateString('en-US', { 
                                weekday: 'long',
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}</div>
                            <div class="streams-create-file-button-container">
                                <button class="mod-cta streams-create-file-button">Create file</button>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add event listener to the button
                const createButton = viewContent.querySelector('.streams-create-file-button');
                if (createButton) {
                    createButton.addEventListener('click', async () => {
                        try {
                            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
                            
                            if (folderPath) {
                                try {
                                    const folderExists = app.vault.getAbstractFileByPath(folderPath);
                                    if (!folderExists) {
                                        await app.vault.createFolder(folderPath);
                                    }
                                } catch (error) {
                                    // Using existing folder
                                }
                            }
                            
                            const file = await app.vault.create(filePath, '');
                            
                            if (file instanceof TFile) {
                                await leaf!.openFile(file);
                            }
                        } catch (error) {
                            centralizedLogger.error('Error creating file:', error);
                        }
                    });
                }
                
                // Set the active leaf
                app.workspace.setActiveLeaf(leaf, { focus: true });
                
                // Trigger calendar component to be added to this view AFTER our content is created
                try {
                    const { eventBus } = await import('../../shared/event-bus');
                    eventBus.emit('create-file-view-opened', leaf);
                } catch (error) {
                    centralizedLogger.error('Calendar component trigger failed:', error);
                }
            } else {
                centralizedLogger.error('Could not find view-content in leaf container');
            }
            
        } catch (error) {
            centralizedLogger.error('Error setting up CreateFileView content:', error);
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