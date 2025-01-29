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

export async function createDailyNote(app: App, folder: string) {
    const date = new Date();
    const fileName = date.toISOString().split('T')[0] + '.md';
    const normalizedPath = normalize(join(folder, fileName));

    let file = app.vault.getAbstractFileByPath(normalizedPath);
    
    if (!file) {
        // Create folder if it doesn't exist
        const folderPath = normalize(folder);
        if (!app.vault.getAbstractFileByPath(folderPath)) {
            await app.vault.createFolder(folderPath);
        }
        
        // Create the daily note
        file = await app.vault.create(normalizedPath, '');
    }

    // Open the file
    const leaf = app.workspace.getUnpinnedLeaf();
    if (file instanceof TFile) {
        await leaf.openFile(file);
    }
} 