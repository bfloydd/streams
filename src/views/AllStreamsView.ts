import { App, ItemView, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../types';
import { Logger } from '../utils/Logger';

// Interface for accessing internal Obsidian properties
interface AppWithInternal extends App {
    plugins: {
        plugins: {
            [key: string]: any;
        };
    };
    commands: {
        executeCommandById: (commandId: string) => void;
    };
}

// Interface for the streams plugin
interface StreamsPlugin {
    setActiveStream(streamId: string): void;
}

export const ALL_STREAMS_VIEW_TYPE = 'streams-all-streams-view';

export class AllStreamsView extends ItemView {
    public app: App;
    private log: Logger;
    private streamsContainer: HTMLElement;
    private streams: Stream[] = [];

    constructor(leaf: WorkspaceLeaf, app: App) {
        super(leaf);
        this.app = app;
        this.log = new Logger();
    }

    getViewType(): string {
        return ALL_STREAMS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'All Streams';
    }

    getIcon(): string {
        return 'layout-dashboard';
    }

    async onOpen(): Promise<void> {
        this.log.debug('Opening All Streams view');
        
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('streams-all-streams-container');

        // Get streams from plugin settings
        const appWithInternal = this.app as AppWithInternal;
        const plugin = appWithInternal.plugins.plugins['streams'];
        if (plugin) {
            this.streams = plugin.settings.streams;
        }

        // Create header
        const header = container.createDiv('streams-all-streams-header');
        header.createEl('h1', { text: 'All Streams' });
        header.createEl('p', { 
            text: `You have ${this.streams.length} stream${this.streams.length !== 1 ? 's' : ''} configured`,
            cls: 'streams-all-streams-subtitle'
        });

        // Create streams container
        this.streamsContainer = container.createDiv('streams-all-streams-grid');
        
        // Load and display streams
        await this.loadStreamsData();
    }

    private async loadStreamsData(): Promise<void> {
        if (this.streams.length === 0) {
            this.showNoStreamsMessage();
            return;
        }

        // Clear existing content
        this.streamsContainer.empty();

        // Create cards for each stream
        for (const stream of this.streams) {
            const card = await this.createStreamCard(stream);
            this.streamsContainer.appendChild(card);
        }
    }

    private async createStreamCard(stream: Stream): Promise<HTMLElement> {
        const card = document.createElement('div');
        card.className = 'streams-all-streams-card';
        
        // Get stream statistics
        const stats = await this.getStreamStats(stream);
        
        // Create card header
        const header = card.createDiv('streams-all-streams-card-header');
        const icon = header.createDiv('streams-all-streams-card-icon');
        // Use a simple icon representation
        icon.innerHTML = `<span class="streams-all-streams-card-icon-text">${stream.icon.charAt(0).toUpperCase()}</span>`;
        
        const title = header.createEl('h3', { text: stream.name });
        title.className = 'streams-all-streams-card-title';
        
        // Create card content
        const content = card.createDiv('streams-all-streams-card-content');
        
        // Folder path
        const folderInfo = content.createDiv('streams-all-streams-card-folder');
        folderInfo.innerHTML = `<strong>Folder:</strong> <code>${stream.folder || 'Root'}</code>`;
        
        // Statistics
        const statsContainer = content.createDiv('streams-all-streams-card-stats');
        
        // Total files
        const totalFiles = statsContainer.createDiv('streams-all-streams-stat');
        totalFiles.innerHTML = `<span class="streams-all-streams-stat-label">Total Files:</span> <span class="streams-all-streams-stat-value">${stats.totalFiles}</span>`;
        
        // This year files
        const thisYearFiles = statsContainer.createDiv('streams-all-streams-stat');
        thisYearFiles.innerHTML = `<span class="streams-all-streams-stat-label">This Year:</span> <span class="streams-all-streams-stat-value">${stats.thisYearFiles}</span>`;
        
        // This month files
        const thisMonthFiles = statsContainer.createDiv('streams-all-streams-stat');
        thisMonthFiles.innerHTML = `<span class="streams-all-streams-stat-label">This Month:</span> <span class="streams-all-streams-stat-value">${stats.thisMonthFiles}</span>`;
        
        // Last modified
        if (stats.lastModified) {
            const lastModified = statsContainer.createDiv('streams-all-streams-stat');
            lastModified.innerHTML = `<span class="streams-all-streams-stat-label">Last Modified:</span> <span class="streams-all-streams-stat-value">${stats.lastModified}</span>`;
        }
        
        // Create card actions
        const actions = card.createDiv('streams-all-streams-card-actions');
        
        // Today button
        const todayBtn = actions.createEl('button', { text: 'Today' });
        todayBtn.className = 'streams-all-streams-card-btn streams-all-streams-card-btn-primary';
        todayBtn.addEventListener('click', () => {
            this.openTodayStream(stream);
        });
        
        // View All button
        const viewAllBtn = actions.createEl('button', { text: 'View All' });
        viewAllBtn.className = 'streams-all-streams-card-btn streams-all-streams-card-btn-secondary';
        viewAllBtn.addEventListener('click', () => {
            this.openStreamView(stream);
        });
        
        return card;
    }

    private async getStreamStats(stream: Stream): Promise<{
        totalFiles: number;
        thisYearFiles: number;
        thisMonthFiles: number;
        lastModified: string | null;
    }> {
        try {
            if (!stream.folder) {
                return { totalFiles: 0, thisYearFiles: 0, thisMonthFiles: 0, lastModified: null };
            }

            const folder = this.app.vault.getAbstractFileByPath(stream.folder);
            if (!(folder instanceof TFolder)) {
                return { totalFiles: 0, thisYearFiles: 0, thisMonthFiles: 0, lastModified: null };
            }

            const files = this.getFilesInFolder(folder);
            const totalFiles = files.length;
            
            const now = new Date();
            const thisYear = now.getFullYear();
            const thisMonth = now.getMonth();
            
            let thisYearFiles = 0;
            let thisMonthFiles = 0;
            let lastModified: Date | null = null;
            
            for (const file of files) {
                if (file instanceof TFile) {
                    // Check if it's a date-based file (YYYY-MM-DD.md)
                    const dateMatch = file.basename.match(/^\d{4}-\d{2}-\d{2}$/);
                    if (dateMatch) {
                        const fileDate = new Date(file.basename);
                        if (fileDate.getFullYear() === thisYear) {
                            thisYearFiles++;
                        }
                        if (fileDate.getFullYear() === thisYear && fileDate.getMonth() === thisMonth) {
                            thisMonthFiles++;
                        }
                    }
                    
                    // Track last modified
                    if (!lastModified || file.stat.mtime > lastModified.getTime()) {
                        lastModified = new Date(file.stat.mtime);
                    }
                }
            }
            
            return {
                totalFiles,
                thisYearFiles,
                thisMonthFiles,
                lastModified: lastModified ? this.formatDate(lastModified) : null
            };
        } catch (error) {
            this.log.error('Error getting stream stats:', error);
            return { totalFiles: 0, thisYearFiles: 0, thisMonthFiles: 0, lastModified: null };
        }
    }

    private getFilesInFolder(folder: TFolder): TFile[] {
        const files: TFile[] = [];
        
        function recurseFolder(currentFolder: TFolder) {
            for (const child of currentFolder.children) {
                if (child instanceof TFile) {
                    files.push(child);
                } else if (child instanceof TFolder) {
                    recurseFolder(child);
                }
            }
        }
        
        recurseFolder(folder);
        return files;
    }

    private formatDate(date: Date): string {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    private showNoStreamsMessage(): void {
        this.streamsContainer.innerHTML = `
            <div class="streams-all-streams-empty">
                <div class="streams-all-streams-empty-icon">📝</div>
                <h3>No Streams Configured</h3>
                <p>You haven't configured any streams yet. Go to Settings → Streams to add your first stream.</p>
            </div>
        `;
    }

    private openTodayStream(stream: Stream): void {
        // Set this as the active stream first
        this.setActiveStream(stream);
        
        // Use the existing command to open today's stream
        try {
            const appWithInternal = this.app as AppWithInternal;
            appWithInternal.commands.executeCommandById(`open-${stream.id}`);
        } catch (error) {
            this.log.error('Error executing today command:', error);
            // Fallback: try to open the stream directly
            this.openStreamDate(stream, new Date());
        }
    }

    private openStreamView(stream: Stream): void {
        // Set this as the active stream first
        this.setActiveStream(stream);
        
        // Use the existing command to open the full stream view
        try {
            const appWithInternal = this.app as AppWithInternal;
            appWithInternal.commands.executeCommandById(`view-${stream.id}`);
        } catch (error) {
            this.log.error('Error executing view command:', error);
            // Fallback: try to open the stream view directly
            this.openStreamViewDirect(stream);
        }
    }

    private async openStreamDate(stream: Stream, date: Date): Promise<void> {
        // Direct fallback for opening stream date
        const appWithInternal = this.app as AppWithInternal;
        const plugin = appWithInternal.plugins.plugins['streams'];
        if (plugin) {
            // Import and use the utility function directly
            const { openStreamDate } = await import('../utils/streamUtils');
            openStreamDate(this.app, stream, date);
        }
    }

    private openStreamViewDirect(stream: Stream): void {
        // Direct fallback for opening stream view
        const appWithInternal = this.app as AppWithInternal;
        const plugin = appWithInternal.plugins.plugins['streams'];
        if (plugin) {
            // Import and use the command directly
            import('../commands/OpenStreamViewCommand').then(({ OpenStreamViewCommand }) => {
                const command = new OpenStreamViewCommand(this.app, stream);
                command.execute();
            });
        }
    }
    
    private setActiveStream(stream: Stream): void {
        // Set this as the active stream in the main plugin
        const appWithInternal = this.app as AppWithInternal;
        const plugin = appWithInternal.plugins.plugins['streams'] as StreamsPlugin;
        if (plugin && plugin.setActiveStream) {
            plugin.setActiveStream(stream.id);
        }
    }

    async onClose(): Promise<void> {
        this.log.debug('Closing All Streams view');
    }
}
