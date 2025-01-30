import { App, TFolder, TFile } from 'obsidian';
import { join, normalize } from 'path';

export function getFolderSuggestions(app: App): string[] {
    const folders: string[] = [];
    
    function recurseFolder(folder: TFolder, path: string = '') {
        const folderPath = join(path, folder.name);
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

    // Normalize folder path: remove leading/trailing slashes and normalize separators
    const folderPath = folder
        .split(/[/\\]/)  // Split on both forward and back slashes
        .filter(Boolean)  // Remove empty segments
        .join('/');      // Join with forward slashes (Obsidian's preferred format)

    // Construct the full file path
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Try to get existing file first
    let file = app.vault.getAbstractFileByPath(filePath);
    
    if (!file) {
        try {
            // Create folder if it doesn't exist and folder path is specified
            if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
                await app.vault.createFolder(folderPath);
            }
            
            // Create the daily note with a basic template
            const template = `# Daily Note - ${year}-${month}-${day}\n\n`;
            file = await app.vault.create(filePath, template);
        } catch (error) {
            // If file was created in the meantime, try to get it again
            if (error.message === 'File already exists.') {
                file = app.vault.getAbstractFileByPath(filePath);
            } else {
                throw error;
            }
        }
    }

    return file instanceof TFile ? file : null;
} 