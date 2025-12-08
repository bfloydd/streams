import { App, TFile, WorkspaceLeaf, ItemView, setIcon } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { DateStateManager, DateState } from '../../shared/DateStateManager';
import { FileCreationService } from './FileCreationService';
import { EmptyStateObserver } from './EmptyStateObserver';
import { StreamManager } from '../../shared/interfaces';
import { MeldDetectionService } from '../../slices/meld-integration';

// Interface for accessing app.plugins
interface AppWithPlugins extends App {
    plugins: {
        plugins: {
            'streams': StreamManager;
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
        this.dateStateManager = new DateStateManager();

        // Initialize MeldDetectionService with plugin context
        const meldDetectionService = new MeldDetectionService();
        meldDetectionService.setPlugin((app as any).plugins.plugins['streams']);

        this.fileCreationService = new FileCreationService(app, meldDetectionService);
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
                console.log(`[CreateFileView] setState called with stream: ${state.stream?.name}`);

                // Update properties
                this.stream = state.stream || this.stream;

                // Handle date parameter first (triggers handleDateChange)
                // We do this first so the DateStateManager has the correct date
                if (state.date) {
                    const date = typeof state.date === 'string' ? new Date(state.date) : state.date;
                    if (!isNaN(date.getTime())) {
                        this.dateStateManager.setCurrentDate(date);
                    }
                }

                // Determine file path:
                // 1. Use explicitly provided filePath from state
                // 2. Or assume it's valid if we already have one (and no stream change?) 
                //    But if stream changed, we MUST recalculate or use provided path.
                //    Actually, if state.filePath is provided, use it.
                //    Otherwise, calculate from current date and stream.
                if (state.filePath) {
                    this.filePath = state.filePath;
                } else {
                    // Recalculate file path based on current stream and date (which is now updated)
                    const currentDate = this.dateStateManager.getState().currentDate;
                    const fileName = `${this.formatDateToYYYYMMDD(currentDate)}.md`;
                    const streamFolder = this.stream.folder.replace(/\/$/, '');
                    this.filePath = `${streamFolder}/${fileName}`;
                }

                console.log(`[CreateFileView] New file path: ${this.filePath}`);

                // Refresh the view with new state
                if (this.contentEl) {
                    console.log(`[CreateFileView] Re-rendering content for stream: ${this.stream.name}`);
                    this.contentEl.empty();
                    this.contentEl.addClass('streams-create-file-container');
                    this.createFileViewContent(this.contentEl);
                }
            }
        } catch (error) {
            centralizedLogger.error(`Error in CreateFileView setState:`, error);
        }
    }


    private handleDateChange(state: DateState): void {
        console.log(`[CreateFileView] handleDateChange triggered. Updating path and content.`);
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
        // Set this as the active stream in the main plugin - REMOVED logic
        // await this.setActiveStream();

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
            import('../../shared/EventBus').then(({ eventBus }) => {
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


} 
