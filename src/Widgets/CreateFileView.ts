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
        // Extract just the filename without extension for the tab title
        const fileName = this.filePath.split('/').pop()?.replace('.md', '') || '';
        return fileName;
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
            this.log.debug(`Setting state with: ${JSON.stringify(state)}`);
            
            const oldFilePath = this.filePath;
            const oldDate = this.date ? new Date(this.date.getTime()) : null;
            
            this.filePath = state.filePath || this.filePath;
            this.stream = state.stream || this.stream;
            
            let dateChanged = false;
            
            if (state.date) {
                // Handle date which could be a string or Date object
                try {
                    if (typeof state.date === 'string') {
                        this.date = new Date(state.date);
                        this.log.debug(`Parsed date from string: ${this.date.toISOString()}`);
                    } else if (state.date instanceof Date) {
                        this.date = state.date;
                        this.log.debug(`Used date object directly: ${this.date.toISOString()}`);
                    } else {
                        // Try to extract date from filepath if all else fails
                        const filePathMatch = this.filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/);
                        if (filePathMatch && filePathMatch[1]) {
                            const [year, month, day] = filePathMatch[1].split('-').map(n => parseInt(n, 10));
                            this.date = new Date(year, month - 1, day);
                            this.log.debug(`Extracted date from filepath: ${this.date.toISOString()}`);
                        } else {
                            this.date = new Date(); // Last resort fallback
                            this.log.debug(`Using current date as fallback: ${this.date.toISOString()}`);
                        }
                    }
                    
                    // Validate the date
                    if (isNaN(this.date.getTime())) {
                        this.log.error(`Invalid date after parsing: ${state.date}`);
                        // Try to extract from filename as fallback
                        this.extractDateFromFilename();
                    }
                    
                    // Check if date has changed
                    if (oldDate && this.date) {
                        dateChanged = oldDate.toDateString() !== this.date.toDateString();
                    }
                    
                } catch (error) {
                    this.log.error(`Error setting date: ${error}`);
                    // Try to extract from filename as fallback
                    this.extractDateFromFilename();
                }
            } else {
                // Try to extract from filename if no date provided
                this.extractDateFromFilename();
            }
            
            // If date or file path changed, refresh the view
            if (dateChanged || oldFilePath !== this.filePath) {
                this.log.debug("Date or file path changed, refreshing view");
                await this.refreshView();
            }
        }
    }

    private extractDateFromFilename(): void {
        // Extract date from filename
        const fileNameMatch = this.filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/);
        if (fileNameMatch && fileNameMatch[1]) {
            const [year, month, day] = fileNameMatch[1].split('-').map(n => parseInt(n, 10));
            this.date = new Date(year, month - 1, day);
            this.log.debug(`Extracted date from filename fallback: ${this.date.toISOString()}`);
        } else {
            this.date = new Date();
            this.log.debug(`Using today as final fallback: ${this.date.toISOString()}`);
        }
    }

    async onOpen(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass('streams-create-file-container');
        
        // Always ensure we have the correct date based on the file path first
        const fileNameMatch = this.filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/);
        if (fileNameMatch && fileNameMatch[1]) {
            const [year, month, day] = fileNameMatch[1].split('-').map(n => parseInt(n, 10));
            const fileDate = new Date(year, month - 1, day);
            
            if (!isNaN(fileDate.getTime())) {
                if (!this.date || this.date.toDateString() !== fileDate.toDateString()) {
                    this.log.debug(`Updating date from file path: ${fileDate.toISOString()}`);
                    this.date = fileDate;
                }
            }
        }
        
        const container = this.contentEl.createDiv('streams-create-file-content');
        
        // Create note icon at the top
        const iconContainer = container.createDiv('streams-create-file-icon');
        setIcon(iconContainer, 'file-plus');
        
        // Stream name with icon
        const streamContainer = container.createDiv('streams-create-file-stream-container');
        const streamIcon = streamContainer.createSpan('streams-create-file-stream-icon');
        setIcon(streamIcon, this.stream.icon || 'book');
        
        const streamName = streamContainer.createSpan('streams-create-file-stream');
        streamName.setText(this.stream.name);
        
        // Date with more prominence - no calendar icon
        const dateEl = container.createDiv('streams-create-file-date');
        
        // Log the date to help with debugging
        this.log.debug(`Date for formatting: ${this.date.toISOString()}`);
        
        // Make sure we have a valid date object
        if (!(this.date instanceof Date) || isNaN(this.date.getTime())) {
            this.log.error("Invalid date object, creating a new one");
            this.extractDateFromFilename();
        }
        
        const formattedDate = this.formatDate(this.date);
        this.log.debug(`Formatted date for display: ${formattedDate}`);
        dateEl.setText(formattedDate);
        
        // Create button
        const buttonContainer = container.createDiv('streams-create-file-button-container');
        const createButton = buttonContainer.createEl('button', {
            cls: 'mod-cta streams-create-file-button',
            text: 'Create file'
        });
        
        createButton.addEventListener('click', async () => {
            await this.createAndOpenFile();
        });
    }
    
    private formatDate(date: Date): string {
        this.log.debug(`Formatting date: ${date.toISOString()}`);
        
        try {
            return date.toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } catch (error) {
            this.log.error(`Error formatting date: ${error}`);
            return "Invalid Date";
        }
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

    private async refreshView(): Promise<void> {
        // Force a refresh of the view content
        this.contentEl.empty();
        await this.onOpen();
    }
} 