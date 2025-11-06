import { App, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../shared/types';
import { CreateFileView, CREATE_FILE_VIEW_TYPE } from '../file-operations/CreateFileView';
import { centralizedLogger } from '../../shared/centralized-logger';

/**
 * Service for managing view registration and view-related operations
 * Extracted from CalendarNavigationService to follow Single Responsibility Principle
 */
export class ViewManagementService {
    private app: App;
    private getStreams: () => Stream[];
    private getDefaultStream: () => Stream;
    private getDefaultFilePath: (stream: Stream) => string;

    constructor(
        app: App,
        getStreams: () => Stream[],
        getDefaultStream: () => Stream,
        getDefaultFilePath: (stream: Stream) => string
    ) {
        this.app = app;
        this.getStreams = getStreams;
        this.getDefaultStream = getDefaultStream;
        this.getDefaultFilePath = getDefaultFilePath;
    }

    /**
     * Register plugin views with the Obsidian app
     */
    registerPluginViews(registerView: (viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any) => void): void {
        // Register CreateFileView
        registerView(
            CREATE_FILE_VIEW_TYPE,
            (leaf) => {
                try {
                    const defaultStream = this.getDefaultStream();
                    const defaultFilePath = this.getDefaultFilePath(defaultStream);
                    
                    const view = new CreateFileView(leaf, this.app, defaultFilePath, defaultStream);
                    return view;
                } catch (error) {
                    centralizedLogger.error(`[ViewManagementService] Error creating CreateFileView:`, error);
                    // Return a minimal view that won't cause errors
                    return {
                        getViewType: () => CREATE_FILE_VIEW_TYPE,
                        getDisplayText: () => 'Create File',
                        getState: () => ({}),
                        setState: () => Promise.resolve(),
                        onOpen: () => Promise.resolve(),
                        onClose: () => Promise.resolve()
                    } as any;
                }
            }
        );
    }

    /**
     * Check if a view type should have a calendar component
     */
    shouldCreateCalendarForViewType(viewType: string): boolean {
        return viewType === 'empty' || 
               viewType === 'file-explorer' || 
               viewType === 'search' || 
               viewType === 'graph' ||
               viewType === 'markdown' ||
               viewType === CREATE_FILE_VIEW_TYPE ||
               viewType === 'streams-install-meld-view' ||
               viewType === 'streams-create-file-view-encrypted';
    }

    /**
     * Check if a leaf belongs to the main editor area (not sidebars)
     */
    isMainEditorLeaf(leaf: WorkspaceLeaf): boolean {
        const mainEditorArea = document.querySelector('.workspace-split.mod-vertical.mod-root');
        if (!mainEditorArea) {
            return false;
        }
        
        return mainEditorArea.contains(leaf.view.containerEl);
    }
}

