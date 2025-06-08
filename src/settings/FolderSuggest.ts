import { AbstractInputSuggest, App, TFolder } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<string> {
    private folders: string[];
    private inputEl: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.inputEl = inputEl;
        this.updateFolders();
    }

    private updateFolders(): void {
        // Include root folder and all existing folders
        this.folders = [''].concat(
            this.app.vault.getAllFolders()
                .map(folder => folder.path)
                .sort()
        );
    }

    getSuggestions(inputStr: string): string[] {
        // Update folders in case new ones were created
        this.updateFolders();
        
        const inputLower = inputStr.toLowerCase();
        return this.folders.filter(folder => 
            folder.toLowerCase().includes(inputLower)
        );
    }

    renderSuggestion(folder: string, el: HTMLElement): void {
        const div = el.createEl('div', { cls: 'streams-folder-suggestion' });
        
        if (folder === '') {
            div.createEl('span', { 
                text: 'Root folder',
                cls: 'streams-folder-suggestion-text'
            });
            div.createEl('span', { 
                text: '/',
                cls: 'streams-folder-suggestion-path'
            });
        } else {
            div.createEl('span', { 
                text: folder,
                cls: 'streams-folder-suggestion-text'
            });
        }
    }

    selectSuggestion(folder: string, evt: MouseEvent | KeyboardEvent): void {
        this.inputEl.value = folder;
        
        // Trigger input event to notify any change listeners
        const event = new Event('input', { bubbles: true });
        this.inputEl.dispatchEvent(event);
        
        this.close();
    }
} 