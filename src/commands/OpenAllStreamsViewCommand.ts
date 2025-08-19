import { App, WorkspaceLeaf } from 'obsidian';
import { ALL_STREAMS_VIEW_TYPE, AllStreamsView } from '../views/AllStreamsView';

export class OpenAllStreamsViewCommand {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async execute(): Promise<void> {
        // Look for existing All Streams view
        let leaf: WorkspaceLeaf | null = null;
        const existingLeaves = this.app.workspace.getLeavesOfType(ALL_STREAMS_VIEW_TYPE);
        
        if (existingLeaves.length > 0) {
            // Reuse existing leaf
            leaf = existingLeaves[0];
        } else {
            // Create new leaf
            leaf = this.app.workspace.getLeaf('tab');
        }

        // Set the view state
        await leaf.setViewState({
            type: ALL_STREAMS_VIEW_TYPE,
            state: {}
        });

        // Activate the leaf
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
    }
}
