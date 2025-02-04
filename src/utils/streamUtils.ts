import { App, TFolder, TFile, MarkdownView } from 'obsidian';
import { join, normalize } from 'path';
import { Stream } from '../../types';
import { Logger } from './Logger';

const log = new Logger();

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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const fileName = `${year}-${month}-${day}.md`;

    // Normalize folder path
    const folderPath = folder
        .split(/[/\\]/)
        .filter(Boolean)
        .join('/');

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
    // Format date as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const fileName = `${year}-${month}-${day}.md`;

    // Normalize folder path - ensure forward slashes
    const folderPath = stream.folder
        .split(/[/\\]/)  // Split on both forward and back slashes
        .filter(Boolean)
        .join('/');      // Always join with forward slashes
    
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Try to find existing file or create new one
    let file = app.vault.getAbstractFileByPath(filePath);
    if (!file) {
        // Create folder if it doesn't exist
        if (folderPath) {
            try {
                const folderExists = app.vault.getAbstractFileByPath(folderPath);
                if (!folderExists) {
                    await app.vault.createFolder(folderPath);
                }
            } catch (error) {
                log.debug('Using existing folder:', folderPath);
            }
        }
        
        try {
            file = await app.vault.create(filePath, '');
        } catch (error) {
            log.debug('Using existing file:', filePath);
            file = app.vault.getAbstractFileByPath(filePath);
        }
    }

    if (file instanceof TFile) {
        // Check if file is already open in a tab
        const existingLeaf = app.workspace.getLeavesOfType('markdown')
            .find(leaf => {
                const view = leaf.view as MarkdownView;
                return view && view.file && file && normalize(view.file.path) === normalize(file.path);
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
    }
} 