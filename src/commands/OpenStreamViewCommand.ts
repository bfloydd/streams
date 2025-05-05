import { App, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../types';
import { STREAM_VIEW_TYPE, StreamView } from '../views/StreamView';
import { Logger } from '../utils/Logger';

export class OpenStreamViewCommand {
    private app: App;
    private stream: Stream;
    private log: Logger;

    constructor(app: App, stream: Stream) {
        this.app = app;
        this.stream = stream;
        this.log = new Logger();
    }

    async execute(): Promise<void> {
        const existingStreamView = this.findExistingView();
        if (existingStreamView) {
            this.app.workspace.revealLeaf(existingStreamView.leaf);
            return;
        }

        try {
            const leaf = this.getLeaf();
            
            await leaf.setViewState({
                type: STREAM_VIEW_TYPE,
                state: { streamId: this.stream.id }
            });

            this.app.workspace.revealLeaf(leaf);
        } catch (error) {
            this.log.error('Error opening stream view:', error);
            new Notice('Failed to open stream view');
        }
    }

    private findExistingView(): StreamView | null {
        const leaves = this.app.workspace.getLeavesOfType(STREAM_VIEW_TYPE);
        for (const leaf of leaves) {
            const view = leaf.view as StreamView;
            if (view && view.getState().streamId === this.stream.id) {
                return view;
            }
        }
        return null;
    }

    private getLeaf(): WorkspaceLeaf {
        const existingLeaves = this.app.workspace.getLeavesOfType(STREAM_VIEW_TYPE);
        if (existingLeaves.length > 0) {
            return existingLeaves[0];
        }

        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) {
            return leaf;
        }

        return this.app.workspace.getLeaf();
    }
} 