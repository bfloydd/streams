import { App, MarkdownView, WorkspaceLeaf, Notice, ItemView } from 'obsidian';
import { Stream } from '../../types';
import { openStreamDate } from '../utils/streamUtils';
import { Logger } from '../utils/Logger';
import { Command } from './Command';
import { STREAM_VIEW_TYPE } from '../views/StreamView';
import { CREATE_FILE_VIEW_TYPE } from '../views/CreateFileView';
import { ALL_STREAMS_VIEW_TYPE } from '../views/AllStreamsView';

const log = new Logger();

export class OpenCurrentStreamTodayCommand implements Command {
    constructor(
        private app: App,
        private streams: Stream[],
        private reuseCurrentTab: boolean = false,
        private plugin?: any // The main plugin instance to access calendar components
    ) {}
    
    // Interface for the plugin instance
    private getPluginInterface() {
        return this.plugin as {
            getActiveStream(): Stream | null;
            calendarComponents?: Map<string, any>;
        };
    }

    async execute(): Promise<void> {
        log.debug('Executing OpenCurrentStreamTodayCommand');
        
        // Check if there are any streams configured
        if (this.streams.length === 0) {
            log.debug('No streams configured');
            new Notice('No streams configured. Please add streams in the plugin settings first.');
            return;
        }
        
        // Try to find the current stream based on active view
        const currentStream = this.findCurrentStream();
        
        if (!currentStream) {
            log.debug('No current stream found, cannot open today note');
            new Notice('No active stream found. Please open a stream view or file to establish stream context.');
            return;
        }
        
        log.debug(`Opening today's note for current stream: ${currentStream.name}`);
        await openStreamDate(this.app, currentStream, new Date(), this.reuseCurrentTab);
    }
    
    private findCurrentStream(): Stream | null {
        // First priority: Get the active stream from the main plugin
        const pluginInterface = this.getPluginInterface();
        if (pluginInterface && pluginInterface.getActiveStream) {
            const activeStream = pluginInterface.getActiveStream();
            if (activeStream) {
                log.debug(`Found active stream from plugin: ${activeStream.name}`);
                return activeStream;
            }
        }
        
        // Fallback: Check if there's an active calendar component
        const streamFromCalendar = this.findStreamFromActiveCalendar();
        if (streamFromCalendar) {
            return streamFromCalendar;
        }
        
        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf) {
            log.debug('No active leaf found');
            return null;
        }
        
        const view = activeLeaf.view;
        if (!view) {
            log.debug('No view found in active leaf');
            return null;
        }
        
        // Handle markdown views (most common case)
        if (view instanceof MarkdownView) {
            const file = view.file;
            if (file) {
                return this.findStreamByFilePath(file.path);
            } else {
                log.debug('MarkdownView has no file');
                return null;
            }
        }
        
        // Handle other view types
        const viewType = view.getViewType();
        log.debug(`Active view type: ${viewType}`);
        
        // Handle StreamView - extract stream from view state
        if (viewType === STREAM_VIEW_TYPE) {
            const streamView = view as any; // Cast to access private properties
            if (streamView.stream && this.isValidStream(streamView.stream)) {
                log.debug(`Found stream from StreamView: ${streamView.stream.name}`);
                return streamView.stream;
            }
        }
        
        // Handle CreateFileView - extract stream from view state
        if (viewType === CREATE_FILE_VIEW_TYPE) {
            const createView = view as any; // Cast to access private properties
            if (createView.stream && this.isValidStream(createView.stream)) {
                log.debug(`Found stream from CreateFileView: ${createView.stream.name}`);
                return createView.stream;
            }
        }
        
        // Handle AllStreamsView - this view doesn't have a specific stream
        if (viewType === ALL_STREAMS_VIEW_TYPE) {
            log.debug('User is in All Streams view - no specific stream context');
            new Notice('Please select a specific stream or open a file that belongs to a stream.');
            return null;
        }
        
        // For other view types, try to extract stream from view state if possible
        if (view instanceof ItemView) {
            try {
                const state = view.getState();
                if (state && state.stream && this.isValidStream(state.stream)) {
                    log.debug(`Found stream from view state: ${state.stream.name}`);
                    return state.stream;
                }
            } catch (error) {
                log.debug('Could not extract stream from view state:', error);
            }
        }
        
        log.debug('No stream found in current view');
        return null;
    }
    
    private findStreamFromActiveCalendar(): Stream | null {
        if (!this.plugin || !this.plugin.calendarComponents) {
            log.debug('No plugin or calendar components available');
            return null;
        }
        
        // Get the active leaf to find the current view context
        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf) {
            log.debug('No active leaf for calendar component lookup');
            return null;
        }
        
        const view = activeLeaf.view;
        if (!view) {
            log.debug('No view for calendar component lookup');
            return null;
        }
        
        // Try to find a calendar component that matches the current view
        for (const [componentId, component] of this.plugin.calendarComponents) {
            try {
                // Check if this component is attached to the current view
                if (component.component && component.component.parentElement) {
                    const parentView = this.findParentView(component.component.parentElement);
                    if (parentView === view) {
                        log.debug(`Found active calendar component for stream: ${component.selectedStream.name}`);
                        return component.selectedStream;
                    }
                }
            } catch (error) {
                log.debug('Error checking calendar component:', error);
            }
        }
        
        log.debug('No active calendar component found');
        return null;
    }
    
    private findParentView(element: HTMLElement): any {
        // Walk up the DOM tree to find the view element
        let current = element;
        while (current && current.parentElement) {
            if (current.classList.contains('markdown-view') || 
                current.classList.contains('streams-create-file-container') ||
                current.classList.contains('streams-view-container')) {
                // Find the closest leaf that contains this element
                const leaves = this.app.workspace.getLeavesOfType('markdown');
                for (const leaf of leaves) {
                    const view = leaf.view as any; // Cast to access contentEl
                    if (view && view.contentEl && view.contentEl.contains(current)) {
                        return view;
                    }
                }
                break;
            }
            current = current.parentElement;
        }
        return null;
    }
    
    private isValidStream(stream: any): stream is Stream {
        return stream && 
               typeof stream === 'object' && 
               typeof stream.id === 'string' && 
               typeof stream.name === 'string' && 
               typeof stream.folder === 'string' && 
               typeof stream.icon === 'string';
    }
    
    private findStreamByFilePath(filePath: string): Stream | null {
        log.debug(`Looking for stream matching file: ${filePath}`);
        
        // Find which stream this file belongs to
        const stream = this.streams.find(s => {
            // Skip streams with empty folders
            if (!s.folder || s.folder.trim() === '') {
                return false;
            }
            
            // Normalize paths for comparison
            const normalizedFilePath = filePath.split(/[/\\]/).filter(Boolean);
            const normalizedStreamPath = s.folder.split(/[/\\]/).filter(Boolean);
            
            // If stream path is empty, skip this stream
            if (normalizedStreamPath.length === 0) {
                return false;
            }
            
            // Check if the file path starts with the stream path
            const isInStreamFolder = normalizedStreamPath.every((part, index) => {
                // Check bounds
                if (index >= normalizedFilePath.length) {
                    return false;
                }
                return normalizedStreamPath[index] === normalizedFilePath[index];
            });
            
            log.debug(`Checking stream "${s.name}" (${s.folder}):`, {
                isInStreamFolder,
                normalizedFilePath,
                normalizedStreamPath
            });
            
            return isInStreamFolder;
        });
        
        if (stream) {
            log.debug(`File belongs to stream: ${stream.name} (${stream.folder})`);
            return stream;
        } else {
            log.debug('File does not belong to any stream');
            return null;
        }
    }
}
