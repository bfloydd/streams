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

export const CREATE_FILE_VIEW_ENCRYPTED_TYPE = 'streams-create-file-view-encrypted';

export class CreateFileViewEncrypted extends ItemView {
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
    }

    getViewType(): string {
        return CREATE_FILE_VIEW_ENCRYPTED_TYPE;
    }

    getDisplayText(): string {
        try {
            const state = this.dateStateManager.getState();
            const dateString = this.formatTitleDate(state.currentDate);
            return `${dateString} (Encrypted)`;
        } catch (error) {
            centralizedLogger.error('Error formatting display text:', error);
            return 'Create Encrypted File';
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
                    this.setActiveStream();
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
                    this.contentEl.addClass('streams-create-file-encrypted-container');
                    this.createFileViewEncryptedContent(this.contentEl);
                }
            }
        } catch (error) {
            centralizedLogger.error(`Error in CreateFileViewEncrypted setState:`, error);
            // Don't rethrow - just log and continue
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
            this.contentEl.addClass('streams-create-file-encrypted-container');
            this.createFileViewEncryptedContent(this.contentEl);
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
        this.setActiveStream();
        
        // Set up date change listener
        this.unsubscribeDateChanged = this.dateStateManager.onDateChanged((state) => {
            this.handleDateChange(state);
        });
        
        // Trigger streams bar component to be added to this view
        this.triggerCalendarComponent();
        
        // Prepare our content element
        this.contentEl.empty();
        this.contentEl.addClass('streams-create-file-encrypted-container');
        
        // Set up the content element styling
        this.contentEl.style.height = '100%';
        this.contentEl.style.width = '100%';
        this.contentEl.style.display = 'flex';
        this.contentEl.style.alignItems = 'center';
        this.contentEl.style.justifyContent = 'center';
        
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
        
        // Create our create file view encrypted content
        this.createFileViewEncryptedContent(this.contentEl);
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
        
        // Clear content and mark as invalid
        if (this.contentEl) {
            this.contentEl.empty();
        }
        
        // Mark the view as invalid to prevent setState calls
        this.contentEl = null as any;
        this.leaf = null as any;
    }
    
    private createFileViewEncryptedContent(container: HTMLElement): void {
        // Create the content box
        const contentBox = container.createDiv('streams-create-file-encrypted-content');
        
        // Add icon
        const iconContainer = contentBox.createDiv('streams-create-file-encrypted-icon');
        setIcon(iconContainer, 'lock');
        
        // Private indicator
        const privateIndicator = contentBox.createDiv('streams-create-file-encrypted-private-indicator');
        const privateIcon = privateIndicator.createSpan('streams-create-file-encrypted-private-icon');
        setIcon(privateIcon, this.stream.icon || 'book');
        const privateText = privateIndicator.createSpan('streams-create-file-encrypted-private-text');
        privateText.setText('Private');
        
        // Date display
        const dateEl = contentBox.createDiv('streams-create-file-encrypted-date');
        
        const state = this.dateStateManager.getState();
        const formattedDate = this.formatDate(state.currentDate);
        dateEl.setText(formattedDate);
        
        // Create button
        const buttonContainer = contentBox.createDiv('streams-create-file-encrypted-button-container');
        const createButton = buttonContainer.createEl('button', {
            cls: 'mod-cta streams-create-file-encrypted-button',
            text: 'Create Encrypted File'
        });
        
        createButton.addEventListener('click', async () => {
            await this.createAndOpenFile();
        });
    }
    
    private triggerCalendarComponent(): void {
        // Trigger the streams bar component to be added to this view
        try {
            import('../../shared/event-bus').then(({ eventBus }) => {
                eventBus.emit('create-file-view-encrypted-opened', this.leaf);
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
        try {
            // Get the file operations service to use the strategy pattern
            const plugin = (this.app as any).plugins?.plugins?.['streams'];
            if (!plugin) {
                centralizedLogger.error('Streams plugin not found');
                return;
            }
            
            // Check if Meld is available for encryption
            const fileOpsService = plugin.getFileOperationsService?.();
            if (fileOpsService && !fileOpsService.isMeldPluginAvailable()) {
                // Show error and don't create file
                new (this.app as any).Notice(fileOpsService.getMeldUnavailableMessage());
                return;
            }
            
            // Create the file normally first (without encryption)
            const file = await this.createFileNormally();
            
            if (file instanceof TFile) {
                // Open the file in the current leaf (this will replace CreateFileViewEncrypted)
                await this.leaf.openFile(file);
                
                // Trigger encryption after the file is opened
                // Small delay to ensure the file is fully loaded
                setTimeout(async () => {
                    await this.triggerEncryption(file);
                }, 200);
            }
        } catch (error) {
            centralizedLogger.error('Error creating encrypted file:', error);
        }
    }
    
    private async createFileNormally(): Promise<TFile | null> {
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
            
            // Create the file normally (without encryption)
            const file = await this.app.vault.create(this.filePath, '');
            return file instanceof TFile ? file : null;
        } catch (error) {
            centralizedLogger.error('Error creating file normally:', error);
            return null;
        }
    }
    
    private async triggerEncryption(file: TFile): Promise<void> {
        try {
            // Ensure the file is the active file
            const activeFile = this.app.workspace.getActiveFile();
            
            if (activeFile?.path !== file.path) {
                // Find a leaf with this file and make it active
                const fileLeaf = this.app.workspace.getLeavesOfType('markdown')
                    .find(leaf => {
                        try {
                            const view = leaf.view as any;
                            return view?.file?.path === file.path;
                        } catch (e) {
                            return false;
                        }
                    });
                
                if (fileLeaf) {
                    this.app.workspace.setActiveLeaf(fileLeaf, { focus: true });
                } else {
                    centralizedLogger.error(`Could not find leaf with file: ${file.path}`);
                    return;
                }
            }
            
            // Small delay to ensure the file is properly active
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try to execute the Meld encryption command
            const command = (this.app as any).commands?.commands?.['meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note'];
            
            if (command && command.callback && typeof command.callback === 'function') {
                try {
                    await command.callback();
                } catch (cmdError) {
                    centralizedLogger.error(`Meld command execution failed:`, cmdError);
                }
            } else {
                // Fallback: Use command palette API
                try {
                    await (this.app as any).commands.executeCommandById('meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note');
                } catch (altError) {
                    centralizedLogger.error('Meld encryption command failed:', altError);
                }
            }
        } catch (error) {
            centralizedLogger.error(`Error triggering encryption for file ${file.path}:`, error);
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
