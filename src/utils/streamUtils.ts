import { App, TFolder, TFile, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../types';
import { Logger } from './Logger';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from '../Widgets/CreateFileView';

const log = new Logger();

function normalizePath(path: string): string {
    // Convert backslashes to forward slashes and remove any duplicate slashes
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Normalize folder path - convert backslashes to forward slashes and filter out empty segments
 */
export function normalizeFolderPath(folder: string): string {
    return folder
        .split(/[/\\]/)  // Split on both forward and back slashes
        .filter(Boolean)
        .join('/');      // Always join with forward slashes
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
    // Format today's date as YYYY-MM-DD
    const date = new Date();
    const fileName = `${formatDateToYYYYMMDD(date)}.md`;

    // Normalize folder path
    const folderPath = normalizeFolderPath(folder);

    // Construct the full file path
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    let file = app.vault.getAbstractFileByPath(filePath);
    
    if (!file) {
        // Create folder if it doesn't exist
        if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
            await app.vault.createFolder(folderPath);
        }
        
        // Create the daily note with an empty template
        const template = '';  // Empty template
        file = await app.vault.create(filePath, template);
    }

    return file instanceof TFile ? file : null;
}

export async function openStreamDate(app: App, stream: Stream, date: Date = new Date()): Promise<void> {
    log.debug(`==== OPEN STREAM DATE START ====`);
    log.debug(`Date provided: ${date.toISOString()}`);
    
    // Validate date
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        log.error(`Invalid date provided: ${date}`);
        return;
    }
    
    // Format date as YYYY-MM-DD
    const fileName = `${formatDateToYYYYMMDD(date)}.md`;
    
    log.debug(`Formatted date: ${formatDateToYYYYMMDD(date)}`);

    // Normalize folder path - ensure forward slashes
    const folderPath = normalizeFolderPath(stream.folder);
    
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
    log.debug(`Looking for file at path: ${filePath}`);

    // Try to find existing file
    let file = app.vault.getAbstractFileByPath(filePath);
    log.debug(`File exists: ${!!file}`);
    
    // If file doesn't exist, show the create file view instead of creating it
    if (!file) {
        log.debug(`File not found: ${filePath}, showing create file view`);
        
        // Create folder if it doesn't exist (we still need the folder to exist)
        if (folderPath) {
            try {
                const folderExists = app.vault.getAbstractFileByPath(folderPath);
                if (!folderExists) {
                    await app.vault.createFolder(folderPath);
                    log.debug(`Created folder: ${folderPath}`);
                }
            } catch (error) {
                log.debug('Using existing folder:', folderPath);
            }
        }
        
        // Look for an existing CreateFileView leaf to reuse
        let leaf: WorkspaceLeaf | null = null;
        
        // First, look for an existing CreateFileView leaf
        const existingCreateFileViewLeaves = app.workspace.getLeavesOfType(CREATE_FILE_VIEW_TYPE);
        if (existingCreateFileViewLeaves.length > 0) {
            // Reuse the first one we find
            leaf = existingCreateFileViewLeaves[0];
            log.debug('Reusing existing CreateFileView leaf');
        } else {
            // If no existing CreateFileView leaf, create a new one
            leaf = app.workspace.getLeaf('tab');
            log.debug('Created a new leaf for CreateFileView');
        }
        
        // Register the view type if not already registered
        // Access the viewRegistry through app as any since it might not be in the type definitions
        const viewRegistry = (app as any).viewRegistry;
        if (viewRegistry && !viewRegistry.getViewCreatorByType(CREATE_FILE_VIEW_TYPE)) {
            viewRegistry.registerView(
                CREATE_FILE_VIEW_TYPE,
                (newLeaf: WorkspaceLeaf) => new CreateFileView(newLeaf, app, filePath, stream, date)
            );
            log.debug(`Registered CreateFileView`);
        }
        
        // Set the view to our custom create view
        await leaf.setViewState({
            type: CREATE_FILE_VIEW_TYPE,
            state: { 
                filePath: filePath, 
                stream: stream,
                date: date.toISOString() 
            }
        });
        log.debug(`Set view state with date: ${date.toISOString()} for file: ${filePath}`);
        
        app.workspace.setActiveLeaf(leaf, { focus: true });
        log.debug(`==== OPEN STREAM DATE END (create view) ====`);
        return;
    }

    if (file instanceof TFile) {
        try {
            // Check if file is already open in a tab
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
                        log.debug('Error comparing files:', e);
                        return false;
                    }
                });

            if (existingLeaf) {
                // Switch to existing tab
                app.workspace.setActiveLeaf(existingLeaf, { focus: true });
            } else {
                // Open in new tab
                const leaf = app.workspace.getLeaf('tab');
                await leaf.openFile(file);
                app.workspace.setActiveLeaf(leaf, { focus: true });
            }
        } catch (e) {
            log.error('Error opening stream date:', e);
        }
    }
} 