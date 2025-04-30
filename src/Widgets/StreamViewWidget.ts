import { App, ItemView, MarkdownRenderer, TFile, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../types';

export const STREAM_VIEW_TYPE = 'streams-full-view';

export class StreamViewWidget extends ItemView {
    private stream: Stream;
    public app: App;
    private streamContentEl: HTMLElement;
    private isLoading: boolean = false;
    private currentDate: Date;
    private olderDates: Date[] = [];
    private loadMoreTrigger: HTMLElement;
    private loadMoreButton: HTMLButtonElement;
    private noMoreContent: boolean = false;

    constructor(leaf: WorkspaceLeaf, app: App, stream: Stream) {
        super(leaf);
        this.app = app;
        this.stream = stream;
        this.currentDate = new Date();
    }

    getViewType(): string {
        return STREAM_VIEW_TYPE;
    }

    getDisplayText(): string {
        return `${this.stream.name} Stream`;
    }

    getIcon(): string {
        return this.stream.icon;
    }

    async onOpen(): Promise<void> {
        // Create the main container
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stream-view-container');

        // Create header
        const header = container.createDiv('stream-view-header');
        header.createEl('h2', { text: `${this.stream.name} Stream` });
        
        // Container for content
        this.streamContentEl = container.createDiv('stream-view-content');
        
        // Load initial content (today)
        await this.loadInitialContent();
        
        // Create load more trigger
        this.loadMoreTrigger = container.createDiv('stream-view-load-more');
        this.loadMoreButton = this.loadMoreTrigger.createEl('button', { 
            text: 'Load more', 
            cls: 'stream-view-load-more-button' 
        });
        
        this.loadMoreButton.addEventListener('click', async () => {
            if (!this.isLoading && !this.noMoreContent) {
                await this.loadMoreContent();
            }
        });

        // Set up intersection observer for infinite scroll
        this.setupInfiniteScroll();
    }

    private setupInfiniteScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading && !this.noMoreContent) {
                    this.loadMoreContent();
                }
            });
        }, { threshold: 0.5 });

        observer.observe(this.loadMoreTrigger);
    }

    async loadInitialContent(): Promise<void> {
        this.isLoading = true;

        try {
            // Get today's date
            const today = new Date();
            
            // Scan the folder for all available files
            const streamFiles = await this.getStreamFiles();
            
            if (streamFiles.length === 0) {
                // No files in the stream at all
                this.renderEmptyState();
                this.isLoading = false;
                return;
            }
            
            // Sort files by date (newest to oldest)
            const sortedFiles = streamFiles.sort((a, b) => b.date.getTime() - a.date.getTime());
            
            // Take the first file (most recent)
            const latestFile = sortedFiles[0];
            
            // Get content for the most recent file
            const content = await this.app.vault.read(latestFile.file);
            
            // Render the content
            this.renderDateContent(latestFile.date, content);
            
            // Store the date
            this.olderDates.push(latestFile.date);
            
            // If we have no files for today, show a button to create today's note
            const todayFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const hasTodayFile = sortedFiles.some(f => 
                f.date.getFullYear() === today.getFullYear() && 
                f.date.getMonth() === today.getMonth() && 
                f.date.getDate() === today.getDate()
            );
            
            if (!hasTodayFile) {
                const createTodayButton = this.streamContentEl.createEl('button', {
                    text: 'Create Today\'s Note',
                    cls: 'stream-view-create-today-button'
                });
                
                createTodayButton.addEventListener('click', () => {
                    this.createTodayFile();
                });
            }
        } catch (error) {
            console.error('Error loading initial content:', error);
            this.renderEmptyState();
        }
        
        this.isLoading = false;
    }

    async loadMoreContent(): Promise<void> {
        if (this.isLoading || this.noMoreContent) return;
        
        this.isLoading = true;
        this.loadMoreButton.textContent = 'Loading...';
        
        try {
            // Get the last date we loaded
            const lastDate = this.olderDates[this.olderDates.length - 1];
            const lastTimestamp = lastDate.getTime();
            
            // Scan the folder for all available files
            const streamFiles = await this.getStreamFiles();
            
            // Sort files by date (newest to oldest)
            const sortedFiles = streamFiles.sort((a, b) => b.date.getTime() - a.date.getTime());
            
            // Find files older than the last date we loaded
            const olderFiles = sortedFiles.filter(file => file.date.getTime() < lastTimestamp);
            
            // Take the next batch (up to 5 files)
            const nextBatch = olderFiles.slice(0, 5);
            
            if (nextBatch.length > 0) {
                // Load and render each file
                for (const fileInfo of nextBatch) {
                    const content = await this.app.vault.read(fileInfo.file);
                    this.renderDateContent(fileInfo.date, content);
                    this.olderDates.push(fileInfo.date);
                }
                
                this.loadMoreButton.textContent = 'Load more';
            } else {
                // No more files to load
                this.noMoreContent = true;
                this.loadMoreButton.textContent = 'No more content';
                this.loadMoreTrigger.classList.add('stream-view-no-more');
            }
        } catch (error) {
            console.error('Error loading more content:', error);
            this.loadMoreButton.textContent = 'Error loading content';
        }
        
        this.isLoading = false;
    }
    
    /**
     * Get all files in the stream folder and extract their dates
     */
    async getStreamFiles(): Promise<{file: TFile, date: Date}[]> {
        // Get all files in the stream folder
        const folder = this.app.vault.getAbstractFileByPath(this.stream.folder);
        if (!folder) return [];
        
        const files: {file: TFile, date: Date}[] = [];
        
        // Function to process a file
        const processFile = (file: TFile) => {
            // Check if the file matches the expected format (YYYY-MM-DD.md)
            const match = file.name.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/);
            if (match) {
                const year = parseInt(match[1]);
                const month = parseInt(match[2]) - 1; // JavaScript months are 0-based
                const day = parseInt(match[3]);
                
                // Create a date object
                const date = new Date(year, month, day);
                
                // Verify it's a valid date
                if (!isNaN(date.getTime())) {
                    files.push({ file, date });
                }
            }
        };
        
        // Get all markdown files in the folder
        const allFiles = this.app.vault.getMarkdownFiles();
        const streamPath = this.stream.folder + '/';
        
        for (const file of allFiles) {
            if (file.path.startsWith(streamPath)) {
                processFile(file);
            }
        }
        
        return files;
    }

    renderDateContent(date: Date, content: string): void {
        // Format date for display
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Create date section
        const dateSection = this.streamContentEl.createDiv('stream-view-date-section');
        
        // Create date header
        const dateHeader = dateSection.createDiv('stream-view-date-header');
        dateHeader.createEl('h3', { text: formattedDate });
        
        // Add click handler to open this specific date
        dateHeader.addEventListener('click', () => {
            this.openDateFile(date);
        });
        
        // Create content container with markdown rendering
        const contentContainer = dateSection.createDiv('stream-view-date-content');
        
        // Use the Obsidian markdown renderer for proper rendering
        MarkdownRenderer.renderMarkdown(content, contentContainer, `${this.stream.folder}/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.md`, this);
    }

    renderEmptyState(): void {
        const emptyState = this.streamContentEl.createDiv('stream-view-empty');
        emptyState.createEl('p', { text: 'No content found for this stream.' });
        
        // Add button to create today's note
        const createButton = emptyState.createEl('button', {
            text: 'Create Today\'s Note',
            cls: 'stream-view-create-button'
        });
        
        createButton.addEventListener('click', () => {
            this.createTodayFile();
        });
    }

    async openDateFile(date: Date): Promise<void> {
        // Format date as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const fileName = `${year}-${month}-${day}.md`;
        const streamPath = `${this.stream.folder}/${fileName}`;

        // Check if file exists
        const file = this.app.vault.getAbstractFileByPath(streamPath);
        if (file && file instanceof TFile) {
            await this.app.workspace.openLinkText(streamPath, '', false);
        }
    }

    async createTodayFile(): Promise<void> {
        // Format today's date
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const fileName = `${year}-${month}-${day}.md`;
        const streamPath = `${this.stream.folder}/${fileName}`;

        // Create file if it doesn't exist
        const file = this.app.vault.getAbstractFileByPath(streamPath);
        if (!file) {
            await this.app.vault.create(streamPath, '');
            await this.app.workspace.openLinkText(streamPath, '', false);
        } else if (file instanceof TFile) {
            await this.app.workspace.openLinkText(streamPath, '', false);
        }
    }

    getState(): any {
        return {
            streamId: this.stream.id,
        };
    }

    async setState(state: any): Promise<void> {
        // Update the view if the stream changes
        if (state.streamId !== this.stream.id) {
            // Find the stream by ID
            const plugin = (this.app as any).plugins.plugins['streams'];
            if (plugin && plugin.settings && plugin.settings.streams) {
                const newStream = plugin.settings.streams.find((s: Stream) => s.id === state.streamId);
                if (newStream) {
                    this.stream = newStream;
                    await this.onOpen();
                }
            }
        }
    }
} 