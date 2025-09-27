import { App, TFile, WorkspaceLeaf, ItemView, setIcon } from 'obsidian';
import { Stream } from '../../shared/types';
import { Logger } from '../debug-logging/Logger';

// Interface for the streams plugin
interface StreamsPlugin {
    	setActiveStream(streamId: string, force?: boolean): void;
}

// Interface for accessing app.plugins
interface AppWithPlugins extends App {
    plugins: {
        plugins: {
            'streams': StreamsPlugin;
        };
    };
}

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
        try {
            const fileName = this.filePath.split('/').pop() || '';
            const extractedDate = this.extractDateFromFilenameString(fileName);
            
            if (extractedDate) {
                const dateString = this.formatTitleDate(extractedDate);
                return dateString;
            }
            
            return fileName.replace('.md', '');
        } catch (error) {
            this.log.error('Error formatting display text:', error);
            return this.filePath.split('/').pop()?.replace('.md', '') || '';
        }
    }

    getState(): { stream: Stream; date: string; filePath: string } {
        const dateISOString = this.date instanceof Date ? this.date.toISOString() : new Date().toISOString();
        
        return {
            filePath: this.filePath,
            stream: this.stream,
            date: dateISOString
        };
    }

    async setState(state: { stream?: Stream; date?: string | Date; filePath?: string }, result?: unknown): Promise<void> {
        if (state) {
            this.log.debug(`Setting state with: ${JSON.stringify(state)}`);
            
            const oldFilePath = this.filePath;
            const oldDate = this.date ? new Date(this.date.getTime()) : null;
            
            this.filePath = state.filePath || this.filePath;
            this.stream = state.stream || this.stream;
            
            let dateChanged = false;
            
            if (state.date) {
                try {
                    if (typeof state.date === 'string') {
                        // Handle YYYY-MM-DD format
                        if (state.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            const [year, month, day] = state.date.split('-').map(n => parseInt(n, 10));
                            this.date = new Date(year, month - 1, day); // month is 0-indexed
                            this.log.debug(`Parsed YYYY-MM-DD date: ${this.date.toISOString()}`);
                        } else {
                            this.date = new Date(state.date);
                            this.log.debug(`Parsed date from string: ${this.date.toISOString()}`);
                        }
                    } else if (state.date instanceof Date) {
                        this.date = state.date;
                        this.log.debug(`Used date object directly: ${this.date.toISOString()}`);
                    } else {
                        const filePathMatch = this.filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/);
                        if (filePathMatch && filePathMatch[1]) {
                            const [year, month, day] = filePathMatch[1].split('-').map(n => parseInt(n, 10));
                            this.date = new Date(year, month - 1, day);
                            this.log.debug(`Extracted date from filepath: ${this.date.toISOString()}`);
                        } else {
                            this.date = new Date();
                            this.log.debug(`Using today as final fallback: ${this.date.toISOString()}`);
                        }
                    }
                    
                    if (oldDate) {
                        dateChanged = oldDate.getTime() !== this.date.getTime();
                    } else {
                        dateChanged = true;
                    }
                } catch (error) {
                    this.log.error(`Error parsing date: ${error}`);
                    this.date = new Date();
                }
            }
            
            const filePathChanged = oldFilePath !== this.filePath;
            const isJustTitleUpdate = result && (result as any).isTitleRefresh;
            
            if ((filePathChanged || dateChanged) && !isJustTitleUpdate) {
                this.log.debug(`State changed significantly, refreshing view`);
                setTimeout(() => {
                    this.refreshView();
                    this.app.workspace.trigger('streams-create-file-state-changed', this);
                }, 0);
            }
        }
    }

    /**
     * Extract a date from a filename string in YYYY-MM-DD.md format
     */
    private extractDateFromFilenameString(filename: string): Date | null {
        const match = filename.match(/(\d{4}-\d{2}-\d{2})\.md$/);
        if (match && match[1]) {
            const [year, month, day] = match[1].split('-').map(n => parseInt(n, 10));
            const date = new Date(year, month - 1, day);
            
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        return null;
    }

    private extractDateFromFilename(): void {
        const extractedDate = this.extractDateFromFilenameString(this.filePath);
        if (extractedDate) {
            this.date = extractedDate;
            this.log.debug(`Extracted date from filename fallback: ${this.date.toISOString()}`);
        } else {
            this.date = new Date();
            this.log.debug(`Using today as final fallback: ${this.date.toISOString()}`);
        }
    }

    async onOpen(): Promise<void> {
        // Set this as the active stream in the main plugin
        this.setActiveStream();
        
        this.contentEl.empty();
        this.contentEl.addClass('streams-create-file-container');
        
        const extractedDate = this.extractDateFromFilenameString(this.filePath);
        if (extractedDate) {
            if (!this.date || this.date.toDateString() !== extractedDate.toDateString()) {
                this.log.debug(`Updating date from file path: ${extractedDate.toISOString()}`);
                this.date = extractedDate;
            }
        }
        
        const container = this.contentEl.createDiv('streams-create-file-content');
        
        const iconContainer = container.createDiv('streams-create-file-icon');
        setIcon(iconContainer, 'file-plus');
        
        // Stream info display
        const streamContainer = container.createDiv('streams-create-file-stream-container');
        const streamIcon = streamContainer.createSpan('streams-create-file-stream-icon');
        setIcon(streamIcon, this.stream.icon || 'book');
        
        const streamName = streamContainer.createSpan('streams-create-file-stream');
        streamName.setText(this.stream.name);
        
        const dateEl = container.createDiv('streams-create-file-date');
        
        this.log.debug(`Date for formatting: ${this.date.toISOString()}`);
        
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
    
    /**
     * Format a date for display in a title
     */
    private formatTitleDate(date: Date): string {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
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
            
            const file = await this.app.vault.create(this.filePath, '');
            
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
        this.contentEl.empty();
        await this.onOpen();
        
        this.updateTabTitle();
        
        this.app.workspace.trigger('layout-change');
    }

    /**
     * Updates the tab title to match the current date
     */
    private updateTabTitle(): void {
        try {
            this.log.debug('Updating tab title');
            
            this.leaf.setViewState({
                type: this.getViewType(),
                state: this.getState(),
            }, { history: false, isTitleRefresh: true });
            
            this.log.debug(`Updated tab title to: ${this.getDisplayText()}`);
        } catch (error) {
            this.log.error('Error updating tab title:', error);
        }
    }
    
    private setActiveStream(): void {
        // Set this as the active stream in the main plugin
        // This is a user-initiated action (opening a create file view), so force the change
        try {
            const appWithPlugins = this.app as unknown as AppWithPlugins;
            const plugin = appWithPlugins.plugins.plugins['streams'];
            if (plugin?.setActiveStream) {
                plugin.setActiveStream(this.stream.id, true);
            }
        } catch (error) {
            this.log.error('Error setting active stream:', error);
        }
    }
} 