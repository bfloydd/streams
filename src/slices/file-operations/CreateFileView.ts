import { App, TFile, WorkspaceLeaf, ItemView, setIcon } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { DateStateManager, DateState } from '../../shared/date-state-manager';
import { FileCreationService } from './FileCreationService';
import { EmptyStateObserver } from './EmptyStateObserver';
import { StreamsPluginInterface } from '../../shared/interfaces';

// Interface for accessing app.plugins
interface AppWithPlugins extends App {
    plugins: {
        plugins: {
            'streams': StreamsPluginInterface;
        };
    };
}

export const CREATE_FILE_VIEW_TYPE = 'streams-create-file-view';

export class CreateFileView extends ItemView {
    navigation = true; // Enable navigation history integration
    
    private filePath: string;
    private stream: Stream;
    private dateStateManager: DateStateManager;
    private unsubscribeDateChanged: (() => void) | null = null;
    private emptyStateObserver: EmptyStateObserver | null = null;
    private fileCreationService: FileCreationService;
    
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
        this.fileCreationService = new FileCreationService(app);
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
        try {
            // Check if the view is still valid - more comprehensive checks
            if (!this || !this.contentEl || !this.leaf || this.contentEl === null || this.leaf === null) {
                return;
            }
            
            // Additional safety check - ensure the view is still attached to the DOM
            if (!document.contains(this.contentEl)) {
                return;
            }
            
            if (state) {
                const previousStream = this.stream;
                this.filePath = state.filePath || this.filePath;
                this.stream = state.stream || this.stream;
                
                // If the stream changed, update the active stream
                if (state.stream && state.stream.id !== previousStream.id) {
                    await this.setActiveStream();
                }
                
                // Handle date parameter
                if (state.date) {
                    const date = typeof state.date === 'string' ? new Date(state.date) : state.date;
                    if (!isNaN(date.getTime())) {
                        this.dateStateManager.setCurrentDate(date);
                    }
                }
                
                // Refresh the view with new state
                if (this.contentEl) {
                    this.contentEl.empty();
                    this.contentEl.addClass('streams-create-file-container');
                    this.createFileViewContent(this.contentEl);
                }
            }
        } catch (error) {
            centralizedLogger.error(`Error in CreateFileView setState:`, error);
            // Don't rethrow - just log and continue
        }
    }


    private handleDateChange(state: DateState): void {
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
        // Set this as the active stream in the main plugin
        await this.setActiveStream();
        
        // Set up date change listener
        this.unsubscribeDateChanged = this.dateStateManager.onDateChanged((state) => {
            this.handleDateChange(state);
        });
        
        // Trigger streams bar component to be added to this view
        this.triggerCalendarComponent();
        
        // Prepare our content element
        this.contentEl.empty();
        this.contentEl.addClass('streams-create-file-container');
        
        // Content element styling is handled by CSS class
        
        // Set up empty state observer
        this.emptyStateObserver = new EmptyStateObserver(this.leaf);
        this.emptyStateObserver.start();
        
        // Create our create file view content
        this.createFileViewContent(this.contentEl);
    }

    async onClose(): Promise<void> {
        // Clean up the empty state observer
        if (this.emptyStateObserver) {
            this.emptyStateObserver.stop();
            this.emptyStateObserver = null;
        }
        
        // Clean up date change listener
        if (this.unsubscribeDateChanged) {
            this.unsubscribeDateChanged();
            this.unsubscribeDateChanged = null;
        }
        
        // Clear content and mark as invalid
        if (this.contentEl) {
            this.contentEl.empty();
        }
        
        // Mark the view as invalid to prevent setState calls
        this.contentEl = null!;
        this.leaf = null!;
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
        // Trigger the streams bar component to be added to this view
        try {
            import('../../shared/event-bus').then(({ eventBus }) => {
                eventBus.emit('create-file-view-opened', this.leaf);
            });
        } catch (error) {
            // Calendar component trigger failed - not critical
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
        await this.fileCreationService.createAndOpenFile(this.filePath, this.stream, this.leaf);
    }
    
    private async setActiveStream(): Promise<void> {
        // Set this as the active stream in the main plugin
        // This is a user-initiated action (opening a create file view), so force the change
        try {
            const appWithPlugins = this.app as unknown as AppWithPlugins;
            const plugin = appWithPlugins.plugins.plugins['streams'];
            if (plugin?.setActiveStream) {
                await plugin.setActiveStream(this.stream.id, true);
            }
        } catch (error) {
            centralizedLogger.error('Error setting active stream:', error);
        }
    }
} 