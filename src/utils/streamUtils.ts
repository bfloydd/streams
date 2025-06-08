import { App, TFolder, TFile, MarkdownView, WorkspaceLeaf, normalizePath } from 'obsidian';
import { Stream } from '../../types';
import { Logger } from '../utils/Logger';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from '../views/CreateFileView';

const log = new Logger();

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

export async function openStreamDate(app: App, stream: Stream, date: Date = new Date()): Promise<void> {
    log.debug(`==== OPEN STREAM DATE START ====`);
    log.debug(`Date provided: ${date.toISOString()}`);
    
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        log.error(`Invalid date provided: ${date}`);
        return;
    }
    
    const fileName = `${formatDateToYYYYMMDD(date)}.md`;
    log.debug(`Formatted date: ${formatDateToYYYYMMDD(date)}`);

    const folderPath = normalizeFolderPath(stream.folder);
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
    log.debug(`Looking for file at path: ${filePath}`);

    let file = app.vault.getAbstractFileByPath(filePath);
    log.debug(`File exists: ${!!file}`);
    
    if (!file) {
        log.debug(`File not found: ${filePath}, showing create file view`);
        
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
        
        let leaf: WorkspaceLeaf | null = null;
        
        const existingCreateFileViewLeaves = app.workspace.getLeavesOfType(CREATE_FILE_VIEW_TYPE);
        if (existingCreateFileViewLeaves.length > 0) {
            leaf = existingCreateFileViewLeaves[0];
            log.debug('Reusing existing CreateFileView leaf');
        } else {
            leaf = app.workspace.getLeaf('tab');
            log.debug('Created a new leaf for CreateFileView');
        }
        
        // Register view if needed - using properly typed interface
        const appWithViewRegistry = app as unknown as AppWithViewRegistry;
        const viewRegistry = appWithViewRegistry.viewRegistry;
        
        if (viewRegistry && !viewRegistry.getViewCreatorByType(CREATE_FILE_VIEW_TYPE)) {
            viewRegistry.registerView(
                CREATE_FILE_VIEW_TYPE,
                (newLeaf: WorkspaceLeaf) => new CreateFileView(newLeaf, app, filePath, stream, date)
            );
            log.debug(`Registered CreateFileView`);
        }
        
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
                app.workspace.setActiveLeaf(existingLeaf, { focus: true });
            } else {
                const leaf = app.workspace.getLeaf('tab');
                await leaf.openFile(file);
                app.workspace.setActiveLeaf(leaf, { focus: true });
            }
        } catch (e) {
            log.error('Error opening stream date:', e);
        }
    }
} 