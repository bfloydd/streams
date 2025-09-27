import { App } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { Stream } from '../../shared/types';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { OpenTodayStreamCommand } from '../file-operations/OpenTodayStreamCommand';
import { OpenTodayCurrentStreamCommand } from '../file-operations/OpenTodayCurrentStreamCommand';

export class RibbonService extends SettingsAwareSliceService {
    private ribbonIconsByStream: Map<string, {today?: HTMLElement}> = new Map();
    private commandsByStreamId: Map<string, string> = new Map();

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.initializeAllRibbonIcons();
        this.initializeStreamCommands();
        this.registerEventBusListeners();

        this.initialized = true;
    }

    cleanup(): void {
        this.removeAllRibbonIcons();
        this.ribbonIconsByStream.clear();
        this.commandsByStreamId.clear();
        this.initialized = false;
    }

    private registerEventBusListeners(): void {
        // Listen for stream changes
        eventBus.subscribe(EVENTS.STREAM_ADDED, (event) => this.onStreamAdded(event.data));
        eventBus.subscribe(EVENTS.STREAM_UPDATED, (event) => this.onStreamUpdated(event.data));
        eventBus.subscribe(EVENTS.STREAM_REMOVED, (event) => this.onStreamRemoved(event.data.streamId));
        eventBus.subscribe(EVENTS.ACTIVE_STREAM_CHANGED, () => this.updateAllRibbonIcons());
        
        // Listen for settings changes
        eventBus.subscribe(EVENTS.SETTINGS_CHANGED, () => this.updateAllRibbonIcons());
    }

    private onStreamAdded(stream: Stream): void {
        this.createStreamIcons(stream);
        this.updateStreamCommands(stream);
    }

    private onStreamUpdated(stream: Stream): void {
        this.removeStreamIcons(stream.id);
        this.createStreamIcons(stream);
        this.updateStreamCommands(stream);
    }

    private onStreamRemoved(streamId: string): void {
        this.removeStreamIcons(streamId);
        this.removeStreamCommand(streamId);
    }

    onSettingsChanged(settings: any): void {
        this.updateAllRibbonIcons();
    }

    public initializeAllRibbonIcons(): void {
        // Create icons for all streams based on their visibility settings
        this.getStreams().forEach(stream => {
            this.createStreamIcons(stream);
        });
    }

    public updateAllRibbonIcons(): void {
        this.removeAllRibbonIcons();
        this.initializeAllRibbonIcons();
    }

    private createAllStreamsIcon(): void {
        // Open Current Stream Today button
        this.getPlugin().addRibbonIcon(
            'calendar',
            'Streams: Open today for current stream',
            () => {
                const command = new OpenTodayCurrentStreamCommand(
                    this.getPlugin().app, 
                    this.getStreams(), 
                    this.getPluginSettings().reuseCurrentTab, 
                    this.getPlugin() as any
                );
                command.execute();
            }
        );
    }

    private createStreamIcons(stream: Stream): void {
        // Get or create entry for this stream
        let streamIcons = this.ribbonIconsByStream.get(stream.id);
        if (!streamIcons) {
            streamIcons = {};
            this.ribbonIconsByStream.set(stream.id, streamIcons);
        }
        
        // Only create the icon if it should be visible
        if (stream.showTodayInRibbon && !streamIcons.today) {
            this.log(`Creating Today icon for stream ${stream.id}`);
            
            streamIcons.today = this.getPlugin().addRibbonIcon(
                stream.icon,
                `Open today for ${stream.name}`,
                () => {
                    const command = new OpenTodayStreamCommand(
                        this.getPlugin().app,
                        stream,
                        this.getPluginSettings().reuseCurrentTab
                    );
                    command.execute();
                }
            );
        }
    }

    private removeStreamIcons(streamId: string): void {
        const streamIcons = this.ribbonIconsByStream.get(streamId);
        if (streamIcons) {
            if (streamIcons.today) {
                streamIcons.today.remove();
                streamIcons.today = undefined;
            }
        }
    }

    private removeAllRibbonIcons(): void {
        for (const streamIcons of this.ribbonIconsByStream.values()) {
            if (streamIcons.today) {
                streamIcons.today.remove();
            }
        }
        this.ribbonIconsByStream.clear();
    }

    private initializeStreamCommands(): void {
        this.getStreams().forEach(stream => {
            this.updateStreamCommands(stream);
        });
    }

    private updateStreamCommands(stream: Stream): void {
        if (stream.addCommand) {
            this.addStreamCommand(stream);
        } else {
            this.removeStreamCommand(stream.id);
        }
    }

    private addStreamCommand(stream: Stream): void {
        // Remove existing command if it exists
        this.removeStreamCommand(stream.id);

        const commandId = `streams-open-today-${stream.id}`;
        
        this.getPlugin().addCommand({
            id: commandId,
            name: `Open today for ${stream.name}`,
            callback: () => {
                const command = new OpenTodayStreamCommand(
                    this.getPlugin().app,
                    stream,
                    this.getPluginSettings().reuseCurrentTab
                );
                command.execute();
            }
        });

        this.commandsByStreamId.set(stream.id, commandId);
    }

    private removeStreamCommand(streamId: string): void {
        const commandId = this.commandsByStreamId.get(streamId);
        if (commandId) {
            // Commands are automatically removed when the plugin unloads
            this.commandsByStreamId.delete(streamId);
        }
    }

    private getStreams(): Stream[] {
        const plugin = this.getPlugin() as any;
        return plugin.settings?.streams || [];
    }

    private getPluginSettings(): any {
        const plugin = this.getPlugin() as any;
        return plugin.settings || {};
    }
}
