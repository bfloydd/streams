import { App, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../shared/types';
import { StreamProvider, FilePathProvider, ViewRegistrar } from '../../shared/interfaces';
import { CreateFileView, CREATE_FILE_VIEW_TYPE } from '../file-operations/CreateFileView';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { createMinimalView } from '../../shared/view-interfaces';

/**
 * Service for registering plugin views
 * Follows Single Responsibility Principle - only handles view registration
 */
export class ViewRegistrationService {
    private app: App;
    private streamProvider: StreamProvider;
    private filePathProvider: FilePathProvider;

    constructor(
        app: App,
        streamProvider: StreamProvider,
        filePathProvider: FilePathProvider
    ) {
        this.app = app;
        this.streamProvider = streamProvider;
        this.filePathProvider = filePathProvider;
    }

    /**
     * Register plugin views with the Obsidian app
     */
    registerPluginViews(viewRegistrar: ViewRegistrar): void {
        // Register CreateFileView
        viewRegistrar.registerView(
            CREATE_FILE_VIEW_TYPE,
            (leaf) => {
                try {
                    const defaultStream = this.streamProvider.getDefaultStream();
                    const defaultFilePath = this.filePathProvider.getDefaultFilePath(defaultStream);

                    const view = new CreateFileView(leaf, this.app, defaultFilePath, defaultStream);
                    return view;
                } catch (error) {
                    centralizedLogger.error(`[ViewRegistrationService] Error creating CreateFileView:`, error);
                    // Return a minimal view that won't cause errors
                    return createMinimalView(CREATE_FILE_VIEW_TYPE, 'Create File');
                }
            }
        );
    }
}
