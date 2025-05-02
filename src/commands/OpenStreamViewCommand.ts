import { App, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../types';
import { STREAM_VIEW_TYPE, StreamViewWidget } from '../Widgets/StreamViewWidget';
import StreamsPlugin from '../../main';
import { Logger } from '../utils/Logger';

export class OpenStreamViewCommand {
    private app: App;
    private stream: Stream;
    private plugin?: StreamsPlugin;
    private log: Logger;

    constructor(app: App, stream: Stream, plugin?: StreamsPlugin) {
        this.app = app;
        this.stream = stream;
        this.plugin = plugin;
        this.log = new Logger(); // Get logger singleton instance
    }

    async execute(): Promise<void> {
        // Check if a stream view for this stream is already open
        const existingStreamView = this.findExistingView();
        if (existingStreamView) {
            // Activate the existing leaf
            this.app.workspace.revealLeaf(existingStreamView.leaf);
            return;
        }

        try {
            // Create a new leaf for the stream view
            const leaf = this.getLeaf();
            
            // Set the view type and state
            await leaf.setViewState({
                type: STREAM_VIEW_TYPE,
                state: { streamId: this.stream.id }
            });

            // Activate the leaf
            this.app.workspace.revealLeaf(leaf);
        } catch (error) {
            this.log.error('Error opening stream view:', error);
            new Notice('Failed to open stream view');
        }
    }

    private findExistingView(): StreamViewWidget | null {
        const leaves = this.app.workspace.getLeavesOfType(STREAM_VIEW_TYPE);
        for (const leaf of leaves) {
            const view = leaf.view as StreamViewWidget;
            if (view && view.getState().streamId === this.stream.id) {
                return view;
            }
        }
        return null;
    }

    private getLeaf(): WorkspaceLeaf {
        // Try to use an existing stream view leaf if possible
        const existingLeaves = this.app.workspace.getLeavesOfType(STREAM_VIEW_TYPE);
        if (existingLeaves.length > 0) {
            return existingLeaves[0];
        }

        // Otherwise create a new leaf in the right sidebar
        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) {
            return leaf;
        }

        // As a fallback, create a new leaf in the main area
        return this.app.workspace.getLeaf();
    }
} 