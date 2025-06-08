import { App, ItemView, MarkdownRenderer, TFile, WorkspaceLeaf, Plugin } from 'obsidian';
import { Stream } from '../../types';
import { Logger } from '../utils/Logger';

export const STREAM_VIEW_TYPE = 'stream-view';

// Interface just for our streams plugin structure
interface StreamsPlugin extends Plugin {
    settings: {
        streams: Stream[];
    };
}

// Interface for accessing app.plugins
interface AppWithPlugins extends App {
    plugins: {
        plugins: {
            'streams': StreamsPlugin;
        };
    };
}

export class StreamView extends ItemView {
    private stream: Stream;
    public app: App;
    private streamContentEl: HTMLElement;
    private isLoading: boolean = false;
    private olderDates: Date[] = [];
    private loadMoreTrigger: HTMLElement;
    private noMoreContent: boolean = false;
    private observer: IntersectionObserver | null = null;
    private scrollTimeout: number | null = null;
    private lastScrollPosition: number = 0;
    private log: Logger;

    constructor(leaf: WorkspaceLeaf, app: App, stream: Stream) {
        super(leaf);
        this.app = app;
        this.stream = stream;
        this.log = new Logger();
    }

    getViewType(): string {
        return STREAM_VIEW_TYPE;
    }

    getDisplayText(): string {
        return `Streams: ${this.stream.name}, full`;
    }

    getIcon(): string {
        return this.stream.viewIcon || this.stream.icon;
    }

    async onOpen(): Promise<void> {
        this.log.debug(`Opening stream view for: ${this.stream.name}`);
        
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('stream-view-container');

        const header = container.createDiv('stream-view-header');
        header.createEl('h2', { text: `${this.stream.name} stream` });
        
        this.streamContentEl = container.createDiv('stream-view-content');
        
        await this.loadInitialContent();
        
        // Create and position trigger for infinite scroll
        this.loadMoreTrigger = container.createDiv('stream-view-scroll-trigger');
        
        this.setupInfiniteScroll();
    }

    private setupInfiniteScroll() {
        this.log.debug(`Setting up infinite scroll for: ${this.stream.name}`);
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        if (this.scrollTimeout) {
            window.clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.log.debug(`Trigger element intersection detected: ${entry.intersectionRatio.toFixed(2)}`);
                    this.triggerLoadMore();
                }
            });
        }, { 
            threshold: [0, 0.1, 0.5, 1.0], // Better detection with multiple thresholds
            rootMargin: '300px 0px' 
        });

        this.observer.observe(this.loadMoreTrigger);
        this.log.debug('Intersection observer started');
        
        // Backup scroll detection with debouncing
        this.registerDomEvent(window, 'scroll', () => {
            if (this.scrollTimeout) {
                window.clearTimeout(this.scrollTimeout);
            }
            
            this.scrollTimeout = window.setTimeout(() => {
                const currentScrollY = window.scrollY;
                const isScrollingDown = currentScrollY > this.lastScrollPosition;
                this.lastScrollPosition = currentScrollY;
                
                if (isScrollingDown && !this.isLoading && !this.noMoreContent) {
                    const rect = this.loadMoreTrigger.getBoundingClientRect();
                    const windowHeight = window.innerHeight;
                    
                    if (rect.top < windowHeight + 300) {
                        this.log.debug(`Scroll trigger detected, distance from viewport: ${(rect.top - windowHeight).toFixed(0)}px`);
                        this.triggerLoadMore();
                    }
                }
            }, 200);
        });
    }

    private triggerLoadMore() {
        if (this.isLoading || this.noMoreContent) {
            return;
        }
        
        this.log.debug('Triggering load more content');
        this.loadMoreContent();
    }

    async loadInitialContent(): Promise<void> {
        this.isLoading = true;
        this.log.debug(`Loading initial content for stream: ${this.stream.name}`);

        try {
            const today = new Date();
            const streamFiles = await this.getStreamFiles();
            
            if (streamFiles.length === 0) {
                this.log.debug('No stream files found, showing empty state');
                this.renderEmptyState();
                this.isLoading = false;
                return;
            }
            
            const sortedFiles = streamFiles.sort((a, b) => b.date.getTime() - a.date.getTime());
            const latestFile = sortedFiles[0];
            
            this.log.debug(`Loading most recent file: ${latestFile.file.path}`);
            const content = await this.app.vault.cachedRead(latestFile.file);
            
            this.renderDateContent(latestFile.date, content);
            this.olderDates.push(latestFile.date);
            
            // Check if we have today's file
            const todayFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const hasTodayFile = sortedFiles.some(f => 
                f.date.getFullYear() === today.getFullYear() && 
                f.date.getMonth() === today.getMonth() && 
                f.date.getDate() === today.getDate()
            );
        } catch (error) {
            this.log.error('Error loading initial content:', error);
            this.renderEmptyState();
        }
        
        this.isLoading = false;
        this.log.debug('Initial content loading complete');
        
        // Check if we need to load more content to fill the viewport
        setTimeout(() => {
            this.checkIfViewportNeedsMoreContent();
        }, 100);
    }

    async loadMoreContent(): Promise<void> {
        if (this.isLoading || this.noMoreContent) {
            this.log.debug(`Load more aborted: ${this.isLoading ? 'Already loading' : 'No more content'}`);
            return;
        }
        
        this.isLoading = true;
        this.log.debug('Loading more content...');
        
        try {
            const lastDate = this.olderDates[this.olderDates.length - 1];
            const lastTimestamp = lastDate.getTime();
            
            this.log.debug(`Looking for content older than: ${lastDate.toISOString()}`);
            
            const streamFiles = await this.getStreamFiles();
            const sortedFiles = streamFiles.sort((a, b) => b.date.getTime() - a.date.getTime());
            const olderFiles = sortedFiles.filter(file => file.date.getTime() < lastTimestamp);
            
            this.log.debug(`Found ${olderFiles.length} older files to load`);
            
            const nextBatch = olderFiles.slice(0, 5);
            
            if (nextBatch.length > 0) {
                for (const fileInfo of nextBatch) {
                    this.log.debug(`Loading file: ${fileInfo.file.path}`);
                    const content = await this.app.vault.cachedRead(fileInfo.file);
                    this.renderDateContent(fileInfo.date, content);
                    this.olderDates.push(fileInfo.date);
                }
                
                this.noMoreContent = olderFiles.length <= nextBatch.length;
                
                if (this.noMoreContent) {
                    this.log.debug('No more content to load after this batch');
                    this.addEndMarker();
                }
            } else {
                this.noMoreContent = true;
                this.log.debug('No more content to load');
                
                this.addEndMarker();
            }
        } catch (error) {
            this.log.error('Error loading more content:', error);
        } finally {
            this.isLoading = false;
            this.log.debug('Loading more content complete');
            
            setTimeout(() => {
                this.checkIfViewportNeedsMoreContent();
            }, 100);
        }
    }
    
    /**
     * Checks if the viewport needs more content and triggers loading if needed
     */
    private checkIfViewportNeedsMoreContent(): void {
        const viewportHeight = window.innerHeight;
        const contentHeight = this.streamContentEl.getBoundingClientRect().height;
        
        if (contentHeight < viewportHeight && !this.noMoreContent) {
            this.log.debug('Content does not fill viewport, loading more');
            this.triggerLoadMore();
        }
    }
    
    /**
     * Adds an invisible end marker to the stream content
     */
    private addEndMarker(): void {
        const endMarker = this.streamContentEl.createDiv('stream-view-end-marker');
        endMarker.textContent = 'End of stream';
    }
    
    /**
     * Get all files in the stream folder and extract their dates
     */
    async getStreamFiles(): Promise<{file: TFile, date: Date}[]> {
        const folder = this.app.vault.getAbstractFileByPath(this.stream.folder);
        if (!folder) return [];
        
        const files: {file: TFile, date: Date}[] = [];
        
        const processFile = (file: TFile) => {
            const match = file.name.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/);
            if (match) {
                const year = parseInt(match[1]);
                const month = parseInt(match[2]) - 1;
                const day = parseInt(match[3]);
                
                const date = new Date(year, month, day);
                
                if (!isNaN(date.getTime())) {
                    files.push({ file, date });
                }
            }
        };
        
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
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const dateSection = this.streamContentEl.createDiv('stream-view-date-section');
        
        const dateHeader = dateSection.createDiv('stream-view-date-header');
        dateHeader.createEl('h3', { text: formattedDate });
        
        dateHeader.addEventListener('click', () => {
            this.openDateFile(date);
        });
        
        const contentContainer = dateSection.createDiv('stream-view-date-content');
        
        const sourcePath = `${this.stream.folder}/${this.formatDateForFilename(date)}.md`;
        
        MarkdownRenderer.render(
            this.app,
            content, 
            contentContainer, 
            sourcePath,
            this
        );
        
        this.processEmbeds(contentContainer, sourcePath);
    }
    
    /**
     * Process embedded content like images for proper rendering
     */
    private processEmbeds(contentEl: HTMLElement, sourcePath: string): void {
        const imageEmbeds = contentEl.querySelectorAll('.internal-embed[src]');
        imageEmbeds.forEach(async (el) => {
            const src = el.getAttribute('src');
            if (!src) return;
            
            try {
                const file = this.app.metadataCache.getFirstLinkpathDest(
                    src, 
                    sourcePath
                );
                
                if (file && file.extension && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(file.extension.toLowerCase())) {
                    el.empty();
                    el.addClass('is-loaded');
                    
                    const img = document.createElement('img');
                    img.src = this.app.vault.getResourcePath(file);
                    el.appendChild(img);
                }
            } catch (error) {
                this.log.error('Error processing embed:', error);
            }
        });
    }

    renderEmptyState(): void {
        const emptyState = this.streamContentEl.createDiv('stream-view-empty');
        emptyState.createEl('p', { text: 'No content found for this stream.' });
    }

    async openDateFile(date: Date): Promise<void> {
        const fileName = `${this.formatDateForFilename(date)}.md`;
        const streamPath = `${this.stream.folder}/${fileName}`;

        const file = this.app.vault.getAbstractFileByPath(streamPath);
        if (file && file instanceof TFile) {
            await this.app.workspace.openLinkText(streamPath, '', false);
        }
    }

    getState(): any {
        return {
            streamId: this.stream.id,
        };
    }

    async setState(state: any): Promise<void> {
        if (state.streamId !== this.stream.id) {
            this.log.debug(`Stream changed from ${this.stream.id} to ${state.streamId}`);
            
            this.isLoading = false;
            this.noMoreContent = false;
            this.olderDates = [];
            
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            
            if (this.scrollTimeout) {
                window.clearTimeout(this.scrollTimeout);
                this.scrollTimeout = null;
            }
            
            // Use the properly typed interfaces
            try {
                const appWithPlugins = this.app as unknown as AppWithPlugins;
                const plugin = appWithPlugins.plugins.plugins['streams'];
                if (plugin?.settings?.streams) {
                    const newStream = plugin.settings.streams.find(s => s.id === state.streamId);
                    if (newStream) {
                        if (!newStream.viewIcon) {
                            newStream.viewIcon = newStream.icon;
                        }
                        this.stream = newStream;
                        
                        this.log.debug(`Rebuilding UI for stream: ${this.stream.name}`);
                        
                        const container = this.containerEl.children[1];
                        container.empty();
                        container.addClass('stream-view-container');
                        
                        const header = container.createDiv('stream-view-header');
                        header.createEl('h2', { text: `${this.stream.name} Stream` });
                        
                        this.streamContentEl = container.createDiv('stream-view-content');
                        
                        await this.loadInitialContent();
                        
                        this.loadMoreTrigger = container.createDiv('stream-view-scroll-trigger');
                        
                        this.setupInfiniteScroll();
                        
                        setTimeout(() => {
                            const viewportHeight = window.innerHeight;
                            const contentHeight = this.streamContentEl.getBoundingClientRect().height;
                            
                            if (contentHeight < viewportHeight && !this.noMoreContent) {
                                this.log.debug('Content does not fill viewport after stream switch, loading more');
                                this.triggerLoadMore();
                            }
                        }, 300);
                    }
                }
            } catch (error) {
                this.log.error('Error accessing plugin:', error);
            }
        }
    }

    async onClose() {
        this.log.debug(`Closing stream view for: ${this.stream.name}`);
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        if (this.scrollTimeout) {
            window.clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
    }

    /**
     * Formats a date as YYYY-MM-DD for filenames
     */
    private formatDateForFilename(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
} 