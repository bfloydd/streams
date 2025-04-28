import { App, TFile, WorkspaceLeaf, ItemView, normalizePath, setIcon } from 'obsidian';
import { Stream } from '../../types';
import { Logger } from '../utils/Logger';

export const CREATE_FILE_VIEW_TYPE = 'streams-create-file-view';

export class CreateFileView extends ItemView {
    private log: Logger = new Logger();
    private filePath: string;
    private date: Date;
    private stream: Stream;
    
    constructor(
        leaf: WorkspaceLeaf, 
        app: App, 
        filePath: string,
        stream: Stream,
        date: Date
    ) {
        super(leaf);
        this.app = app;
        this.filePath = filePath;
        this.stream = stream;
        this.date = date;
    }

    getViewType(): string {
        return CREATE_FILE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return `Create: ${this.filePath}`;
    }

    getState(): any {
        // Format date as ISO string for consistent serialization
        const dateISOString = this.date instanceof Date ? this.date.toISOString() : new Date().toISOString();
        
        return {
            filePath: this.filePath,
            stream: this.stream,
            date: dateISOString
        };
    }

    async setState(state: any, result?: any): Promise<void> {
        if (state) {
            this.filePath = state.filePath || this.filePath;
            this.stream = state.stream || this.stream;
            
            if (state.date) {
                // Handle date which could be a string or Date object
                this.date = typeof state.date === 'string' 
                    ? new Date(state.date) 
                    : state.date;
            }
        }
    }

    async onOpen(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass('streams-create-file-container');
        
        const container = this.contentEl.createDiv('streams-create-file-content');
        
        // Stream name
        const streamName = container.createDiv('streams-create-file-stream');
        streamName.setText(this.stream.name);
        
        // Date
        const dateEl = container.createDiv('streams-create-file-date');
        dateEl.setText(this.formatDate(this.date));
        
        // File path
        const pathEl = container.createDiv('streams-create-file-path');
        pathEl.setText(this.filePath);
        
        // Create button
        const buttonContainer = container.createDiv('streams-create-file-button-container');
        const createButton = buttonContainer.createEl('button', {
            cls: 'mod-cta streams-create-file-button'
        });
        
        // Add text and icon to button
        const buttonContent = createButton.createSpan({
            text: 'Create file'
        });
        buttonContent.addClass('streams-create-file-button-text');
        
        // Add file-plus icon if available
        try {
            setIcon(createButton, 'file-plus');
        } catch (e) {
            // Fallback if icon not available
            this.log.debug('Could not set icon:', e);
        }
        
        createButton.addEventListener('click', async () => {
            await this.createAndOpenFile();
        });
    }
    
    private formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    
    private async createAndOpenFile(): Promise<void> {
        try {
            // Create folder if it doesn't exist
            const folderPath = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
            
            if (folderPath) {
                try {
                    const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
                    if (!folderExists) {
                        await this.app.vault.createFolder(folderPath);
                    }
                } catch (error) {
                    this.log.debug('Using existing folder:', folderPath);
                }
            }
            
            // Create the file
            const file = await this.app.vault.create(this.filePath, '');
            
            // Open the file in the current leaf
            if (file instanceof TFile) {
                await this.leaf.openFile(file);
            }
        } catch (error) {
            this.log.error('Error creating file:', error);
        }
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }
} 