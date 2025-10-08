import { App, TFile, WorkspaceLeaf, ItemView, setIcon, Notice } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { DateStateManager } from '../../shared/date-state-manager';

export const INSTALL_MELD_VIEW_TYPE = 'streams-install-meld-view';

export class InstallMeldView extends ItemView {
    private filePath: string;
    private stream: Stream;
    private date: Date;
    private dateStateManager: DateStateManager;
    private unsubscribeDateChanged: (() => void) | null = null;
    
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
        this.dateStateManager = DateStateManager.getInstance();
    }

    getViewType(): string {
        return INSTALL_MELD_VIEW_TYPE;
    }

    getDisplayText(): string {
        try {
            const dateString = this.formatTitleDate(this.date);
            return `${dateString} (Install Meld)`;
        } catch (error) {
            centralizedLogger.error('Error formatting display text:', error);
            return 'Install Meld Plugin';
        }
    }

    getState(): { stream: Stream; date: string; filePath: string } {
        return {
            filePath: this.filePath,
            stream: this.stream,
            date: this.date.toISOString()
        };
    }

    async setState(state: { stream?: Stream; date?: string | Date; filePath?: string }, result?: unknown): Promise<void> {
        try {
            // Check if the view is still valid
            if (!this || !this.contentEl || !this.leaf || this.contentEl === null || this.leaf === null) {
                return;
            }
            
            // Additional safety check - ensure the view is still attached to the DOM
            if (!document.contains(this.contentEl)) {
                return;
            }
            
            if (state) {
                this.filePath = state.filePath || this.filePath;
                this.stream = state.stream || this.stream;
                
                // Handle date parameter
                if (state.date) {
                    const newDate = typeof state.date === 'string' ? new Date(state.date) : state.date;
                    if (!isNaN(newDate.getTime())) {
                        this.date = newDate;
                    }
                }
                
                // Refresh the view with new state
                if (this.contentEl) {
                    this.contentEl.empty();
                    this.contentEl.addClass('streams-install-meld-container');
                    this.createInstallMeldViewContent(this.contentEl);
                }
            }
        } catch (error) {
            centralizedLogger.error(`Error in InstallMeldView setState:`, error);
        }
    }

    async onOpen(): Promise<void> {
        // Set up date change listener
        this.unsubscribeDateChanged = this.dateStateManager.onDateChanged((state) => {
            this.handleDateChange(state);
        });
        
        // Trigger streams bar component to be added to this view
        this.triggerCalendarComponent();
        
        // Prepare our content element
        this.contentEl.empty();
        this.contentEl.addClass('streams-install-meld-container');
        
        // Set up the content element styling
        this.contentEl.style.height = '100%';
        this.contentEl.style.width = '100%';
        this.contentEl.style.display = 'flex';
        this.contentEl.style.alignItems = 'center';
        this.contentEl.style.justifyContent = 'center';
        
        // Hide any empty-state elements that might still be present
        this.hideEmptyStates();
        
        // Create our install meld view content
        this.createInstallMeldViewContent(this.contentEl);
    }

    async onClose(): Promise<void> {
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
    
    private createInstallMeldViewContent(container: HTMLElement): void {
        // Create the content box
        const contentBox = container.createDiv('streams-install-meld-content');
        
        // Add icon
        const iconContainer = contentBox.createDiv('streams-install-meld-icon');
        setIcon(iconContainer, 'lock');
        
        // Stream info display
        const streamContainer = contentBox.createDiv('streams-install-meld-stream-container');
        const streamIcon = streamContainer.createSpan('streams-install-meld-stream-icon');
        setIcon(streamIcon, this.stream.icon || 'book');
        
        const streamName = streamContainer.createSpan('streams-install-meld-stream');
        streamName.setText(this.stream.name);
        
        // Date display
        const dateEl = contentBox.createDiv('streams-install-meld-date');
        const formattedDate = this.formatDate(this.date);
        dateEl.setText(formattedDate);
        
        // Create button
        const buttonContainer = contentBox.createDiv('streams-install-meld-button-container');
        const createButton = buttonContainer.createEl('button', {
            cls: 'mod-cta streams-install-meld-button',
            text: 'Install Meld Encrypt Plugin'
        });
        
        
        createButton.addEventListener('click', () => {
            this.openMeldPluginPage();
        });
    }
    
    private triggerCalendarComponent(): void {
        // Trigger the streams bar component to be added to this view
        try {
            import('../../shared/event-bus').then(({ eventBus }) => {
                eventBus.emit('install-meld-view-opened', this.leaf);
            });
        } catch (error) {
            // Calendar component trigger failed - not critical
        }
    }
    
    private hideEmptyStates(): void {
        // Check if leaf and view are still valid
        if (!this.leaf || !this.leaf.view || !this.leaf.view.containerEl) {
            return;
        }
        
        const hideEmptyStates = () => {
            // Double-check that leaf and view are still valid
            if (!this.leaf || !this.leaf.view || !this.leaf.view.containerEl) {
                return;
            }
            
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
    }
    
    private formatTitleDate(date: Date): string {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    private handleDateChange(state: any): void {
        // Update the file path based on the new date
        const fileName = `${this.formatDateToYYYYMMDD(state.currentDate)}.mdenc`;
        const folderPath = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
        this.filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
        
        // Refresh the view content
        if (this.contentEl) {
            this.contentEl.empty();
            this.contentEl.addClass('streams-install-meld-container');
            this.createInstallMeldViewContent(this.contentEl);
        }
    }

    private formatDateToYYYYMMDD(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private formatDate(date: Date): string {
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
    
    private openMeldPluginPage(): void {
        // Open the Meld plugin page in the community plugins
        try {
            const setting = (this.app as any).setting;
            setting.open();
            setting.openTabById('community-plugins');
            // Note: We can't directly search for the plugin, but we can open the community plugins tab
            new Notice('Please search for "Meld Encrypt" in the Community Plugins tab');
        } catch (error) {
            centralizedLogger.error('Error opening Meld plugin page:', error);
            new Notice('Please manually search for "Meld Encrypt" in Community Plugins');
        }
    }
    
    
}
