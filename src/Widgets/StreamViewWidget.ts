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
    private observer: IntersectionObserver | null = null;

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
        return `Streams: ${this.stream.name}, Full`;
    }

    getIcon(): string {
        return this.stream.viewIcon || this.stream.icon;
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
        
        // Create invisible scroll trigger for infinite scroll
        this.loadMoreTrigger = container.createDiv('stream-view-scroll-trigger');
        
        // Set up intersection observer for infinite scroll
        this.setupInfiniteScroll();
    }

    private setupInfiniteScroll() {
        // Clean up any previous observer
        if (this.observer) {
            this.observer.disconnect();
        }
        
        // Create a new observer with very low threshold to detect earlier
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading && !this.noMoreContent) {
                    this.loadMoreContent();
                }
            });
        }, { 
            threshold: 0.01, // Very sensitive - 1% visibility triggers loading
            rootMargin: '200px 0px' // Load when within 200px of viewport
        });

        this.observer.observe(this.loadMoreTrigger);
        
        // Also add scroll event as backup
        this.registerDomEvent(window, 'scroll', () => {
            if (this.isLoading || this.noMoreContent) return;
            
            const rect = this.loadMoreTrigger.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            
            // If the trigger is within 300px of the viewport, load more
            if (rect.top < windowHeight + 300) {
                this.loadMoreContent();
            }
        });
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
            
            // Removed "Create Today's Note" button section
        } catch (error) {
            console.error('Error loading initial content:', error);
            this.renderEmptyState();
        }
        
        this.isLoading = false;
    }

    async loadMoreContent(): Promise<void> {
        if (this.isLoading || this.noMoreContent) return;
        
        this.isLoading = true;
        
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
            } else {
                // No more files to load
                this.noMoreContent = true;
                
                // Add an invisible element to indicate no more content
                const endMarker = this.streamContentEl.createDiv('stream-view-end-marker');
                endMarker.textContent = 'End of stream';
                endMarker.style.opacity = '0';
                endMarker.style.height = '1px';
            }
        } catch (error) {
            console.error('Error loading more content:', error);
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
        
        // Format the source path
        const sourcePath = `${this.stream.folder}/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.md`;
        
        // Use the Obsidian markdown renderer with proper context
        MarkdownRenderer.renderMarkdown(
            content, 
            contentContainer, 
            sourcePath,
            this
        );
        
        // Process embedded content (like images)
        this.processEmbeds(contentContainer, sourcePath);
    }
    
    /**
     * Process embedded content like images for proper rendering
     */
    private processEmbeds(contentEl: HTMLElement, sourcePath: string): void {
        // Process image embeds
        const imageEmbeds = contentEl.querySelectorAll('.internal-embed[src]');
        imageEmbeds.forEach(async (el) => {
            const src = el.getAttribute('src');
            if (!src) return;
            
            try {
                // Try to find the file in the vault
                const file = this.app.metadataCache.getFirstLinkpathDest(
                    src, 
                    sourcePath
                );
                
                if (file && file.extension && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(file.extension.toLowerCase())) {
                    // It's an image, render it
                    el.empty();
                    el.addClass('is-loaded');
                    
                    // Create image element
                    const img = document.createElement('img');
                    img.src = this.app.vault.getResourcePath(file);
                    el.appendChild(img);
                }
            } catch (error) {
                console.error('Error processing embed:', error);
            }
        });
    }

    renderEmptyState(): void {
        const emptyState = this.streamContentEl.createDiv('stream-view-empty');
        emptyState.createEl('p', { text: 'No content found for this stream.' });
        
        // Removed "Create Today's Note" button
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

    // Keep the method for backward compatibility but make it do nothing
    async createTodayFile(): Promise<void> {
        // Method intentionally left empty as the "Create Today's Note" functionality has been removed
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
                    // Ensure backward compatibility with older stream objects
                    if (!newStream.viewIcon) {
                        newStream.viewIcon = newStream.icon;
                    }
                    this.stream = newStream;
                    await this.onOpen();
                }
            }
        }
    }

    async onClose() {
        // Clean up observers
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
} 