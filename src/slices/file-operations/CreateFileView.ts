import { App, TFile, WorkspaceLeaf, ItemView, setIcon } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { DateStateManager } from '../../shared/date-state-manager';

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
    private filePath: string;
    private stream: Stream;
    private dateStateManager: DateStateManager;
    private unsubscribeDateChanged: (() => void) | null = null;
    
    constructor(
        leaf: WorkspaceLeaf, 
        app: App, 
        filePath: string,
        stream: Stream
    ) {
        super(leaf);
        this.app = app;
        this.filePath = filePath;
        this.stream = stream;
        this.dateStateManager = DateStateManager.getInstance();
        centralizedLogger.debug(`CreateFileView constructor called with filePath: ${filePath}`);
    }

    getViewType(): string {
        return CREATE_FILE_VIEW_TYPE;
    }

    getDisplayText(): string {
        try {
            const state = this.dateStateManager.getState();
            const dateString = this.formatTitleDate(state.currentDate);
            return dateString;
        } catch (error) {
            centralizedLogger.error('Error formatting display text:', error);
            return 'Create File';
        }
    }

    getState(): { stream: Stream; date: string; filePath: string } {
        const state = this.dateStateManager.getState();
        const dateISOString = state.currentDate.toISOString();
        
        return {
            filePath: this.filePath,
            stream: this.stream,
            date: dateISOString
        };
    }

    async setState(state: { stream?: Stream; date?: string | Date; filePath?: string }, result?: unknown): Promise<void> {
        centralizedLogger.debug(`CreateFileView setState called with state:`, state);
        
        if (state) {
            this.filePath = state.filePath || this.filePath;
            this.stream = state.stream || this.stream;
            
            // Refresh the view with new state
            if (this.contentEl) {
                this.contentEl.empty();
                this.contentEl.addClass('streams-create-file-container');
                this.createFileViewContent(this.contentEl);
            }
        }
    }


    private handleDateChange(state: any): void {
        // Update the file path based on the new date
        const fileName = `${this.formatDateToYYYYMMDD(state.currentDate)}.md`;
        const folderPath = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
        this.filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
        
        // Refresh the view content
        if (this.contentEl) {
            this.contentEl.empty();
            this.contentEl.addClass('streams-create-file-container');
            this.createFileViewContent(this.contentEl);
        }
    }

    private formatDateToYYYYMMDD(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async onOpen(): Promise<void> {
        centralizedLogger.debug(`CreateFileView onOpen called with filePath: ${this.filePath}, stream: ${this.stream.name}`);
        
        // Set this as the active stream in the main plugin
        this.setActiveStream();
        
        // Set up date change listener
        this.unsubscribeDateChanged = this.dateStateManager.onDateChanged((state) => {
            this.handleDateChange(state);
        });
        
        // Trigger calendar component to be added to this view
        this.triggerCalendarComponent();
        
        // Prepare our content element
        this.contentEl.empty();
        this.contentEl.innerHTML = '';
        this.contentEl.addClass('streams-create-file-container');
        
        // Find and replace the view-content area
        const viewContent = this.leaf.view.containerEl.querySelector('.view-content');
        if (viewContent) {
            // Clear the view-content and add our container
            viewContent.innerHTML = '';
            viewContent.appendChild(this.contentEl);
            
            // Ensure view-content takes full space
            const viewContentEl = viewContent as HTMLElement;
            viewContentEl.style.height = '100%';
            viewContentEl.style.width = '100%';
            viewContentEl.style.display = 'flex';
            viewContentEl.style.alignItems = 'center';
            viewContentEl.style.justifyContent = 'center';
        }
        
        // Hide any empty-state elements that might still be present
        const hideEmptyStates = () => {
            const emptyStates = this.leaf.view.containerEl.querySelectorAll('.empty-state, .empty-state-container');
            emptyStates.forEach(el => {
                const htmlEl = el as HTMLElement;
                htmlEl.style.display = 'none';
                htmlEl.style.visibility = 'hidden';
                htmlEl.style.opacity = '0';
                htmlEl.style.height = '0';
                htmlEl.style.overflow = 'hidden';
            });
        };
        
        // Hide them immediately
        hideEmptyStates();
        
        // Set up a MutationObserver to hide them if they get recreated
        const observer = new MutationObserver(() => {
            hideEmptyStates();
        });
        
        observer.observe(this.leaf.view.containerEl, {
            childList: true,
            subtree: true,
            attributes: false
        });
        
        // Store observer for cleanup
        (this as any).emptyStateObserver = observer;
        
        // Create our create file view content
        this.createFileViewContent(this.contentEl);
        
        centralizedLogger.debug('CreateFileView content rendered and made visible');
    }

    async onClose(): Promise<void> {
        // Clean up the MutationObserver
        if ((this as any).emptyStateObserver) {
            (this as any).emptyStateObserver.disconnect();
            (this as any).emptyStateObserver = null;
        }
        
        // Clean up date change listener
        if (this.unsubscribeDateChanged) {
            this.unsubscribeDateChanged();
            this.unsubscribeDateChanged = null;
        }
        
        this.contentEl.empty();
    }
    
    private createFileViewContent(container: HTMLElement): void {
        // Create the content box
        const contentBox = container.createDiv('streams-create-file-content');
        
        // Add icon
        const iconContainer = contentBox.createDiv('streams-create-file-icon');
        setIcon(iconContainer, 'file-plus');
        
        // Stream info display
        const streamContainer = contentBox.createDiv('streams-create-file-stream-container');
        const streamIcon = streamContainer.createSpan('streams-create-file-stream-icon');
        setIcon(streamIcon, this.stream.icon || 'book');
        
        const streamName = streamContainer.createSpan('streams-create-file-stream');
        streamName.setText(this.stream.name);
        
        // Date display
        const dateEl = contentBox.createDiv('streams-create-file-date');
        
        const state = this.dateStateManager.getState();
        const formattedDate = this.formatDate(state.currentDate);
        dateEl.setText(formattedDate);
        
        // Create button
        const buttonContainer = contentBox.createDiv('streams-create-file-button-container');
        const createButton = buttonContainer.createEl('button', {
            cls: 'mod-cta streams-create-file-button',
            text: 'Create file'
        });
        
        createButton.addEventListener('click', async () => {
            await this.createAndOpenFile();
        });
    }
    
    private triggerCalendarComponent(): void {
        // Trigger the calendar component to be added to this view
        try {
            import('../../shared/event-bus').then(({ eventBus }) => {
                eventBus.emit('create-file-view-opened', this.leaf);
            });
        } catch (error) {
            centralizedLogger.debug('Could not trigger calendar component:', error);
        }
    }
    
    private formatTitleDate(date: Date): string {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    private formatDate(date: Date): string {
        // Formatting date
        
        try {
            return date.toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } catch (error) {
            centralizedLogger.error(`Error formatting date: ${error}`);
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
                    // Using existing folder
                }
            }
            
            const file = await this.app.vault.create(this.filePath, '');
            
            if (file instanceof TFile) {
                await this.leaf.openFile(file);
            }
        } catch (error) {
            centralizedLogger.error('Error creating file:', error);
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
            centralizedLogger.error('Error setting active stream:', error);
        }
    }
} 