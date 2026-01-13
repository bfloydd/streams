import { App } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/BaseSlice';
import { Stream, StreamsSettings } from '../../shared/types';
import { eventBus, EVENTS } from '../../shared/EventBus';
import { OpenTodayStreamCommand } from '../file-operations/OpenTodayStreamCommand';
import { OpenTodayPrimaryStreamCommand } from '../file-operations/OpenTodayPrimaryStreamCommand';

export class RibbonService extends SettingsAwareSliceService {
    private ribbonIconsByStream: Map<string, { today?: HTMLElement }> = new Map();
    private commandsByStreamId: Map<string, string> = new Map();
    private instanceId = Math.random().toString(36).substring(7);

    async initialize(): Promise<void> {
        this.log(`[RibbonService-${this.instanceId}] Initializing...`);
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
        this.log(`[RibbonService-${this.instanceId}] Registering event bus listeners`);
        // Listen for stream changes
        eventBus.subscribe(EVENTS.STREAM_ADDED, (event) => {
            if (event.data && 'stream' in event.data) {
                this.onStreamAdded((event.data as any).stream);
            }
        });
        eventBus.subscribe(EVENTS.STREAM_UPDATED, (event) => {
            if (event.data && 'stream' in event.data) {
                this.onStreamUpdated((event.data as any).stream);
            }
        });
        eventBus.subscribe(EVENTS.STREAM_REMOVED, (event) => {
            if (event.data && 'streamId' in event.data) {
                this.onStreamRemoved((event.data as any).streamId);
            }
        });
        // eventBus.subscribe(EVENTS.ACTIVE_STREAM_CHANGED, () => this.updateAllRibbonIcons()); - REMOVED

        // Listen for settings changes
        eventBus.subscribe(EVENTS.SETTINGS_CHANGED, () => {
            this.log('[RibbonService] Received SETTINGS_CHANGED event');
            this.updateAllRibbonIcons();
        });
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

    onSettingsChanged(settings: StreamsSettings): void {
        this.updateAllRibbonIcons();
    }

    public initializeAllRibbonIcons(): void {
        // Create icons for all streams based on their visibility settings
        // Filter out disabled streams
        this.getStreams().filter(stream => !stream.disabled).forEach(stream => {
            this.createStreamIcons(stream);
        });
    }



    private createAllStreamsIcon(): void {
        // Go to primary stream button
        this.getPlugin().addRibbonIcon(
            'calendar',
            'Streams: Go to primary stream',
            () => {
                const command = new OpenTodayPrimaryStreamCommand(
                    this.getPlugin().app,
                    this.getStreams(),
                    this.getPlugin(),
                    this.getSettings().reuseCurrentTab
                );
                command.execute();
            }
        );
    }

    private createStreamIcons(stream: Stream): void {
        this.log(`[RibbonService-${this.instanceId}] createStreamIcons called for ${stream?.name} (${stream?.id}). Show: ${stream?.showTodayInRibbon}, Disabled: ${stream?.disabled}`);

        if (!stream || !stream.id) {
            this.log(`[RibbonService-${this.instanceId}] Attempted to create icons for invalid stream`, stream);
            return;
        }

        // Get or create entry for this stream
        let streamIcons = this.ribbonIconsByStream.get(stream.id);
        if (!streamIcons) {
            streamIcons = {};
            this.ribbonIconsByStream.set(stream.id, streamIcons);
        }

        const shouldBeVisible = stream.showTodayInRibbon && !stream.disabled;

        // Case 1: Should NOT be visible
        if (!shouldBeVisible) {
            if (streamIcons.today) {
                const label = streamIcons.today.getAttribute('aria-label') || 'unknown';
                this.log(`[RibbonService-${this.instanceId}] Toggling OFF: Removing icon for stream "${stream.name}" (ID: ${stream.id}). Button aria-label: "${label}"`);
                streamIcons.today.remove();
                streamIcons.today = undefined;
            } else {
                this.log(`[RibbonService-${this.instanceId}] Toggling OFF (No action): Icon for stream "${stream.name}" was already missing.`);
            }
            // Ensure no ghosts remain
            this.enforceRibbonConsistency();
            return;
        }

        // Case 2: Should be visible
        // Check if existing icon is valid
        if (streamIcons.today) {
            if (streamIcons.today.isConnected) {
                this.log(`[RibbonService-${this.instanceId}] Toggling ON (No action): Icon for stream "${stream.name}" is already present and connected.`);
                // Already valid and in DOM. Do nothing.
                return;
            } else {
                this.log(`[RibbonService-${this.instanceId}] Found disconnected reference for "${stream.name}". Clearing reference.`);
                // Reference exists but not in DOM. Clear reference.
                streamIcons.today = undefined;
            }
        }

        // Clean up any ghosts before creating (but preserve tracked one, which we just checked isn't there)
        // enforceRibbonConsistency is called AFTER creation to ensure we know what the 'tracked' one is.

        this.log(`[RibbonService-${this.instanceId}] Toggling ON: Creating new ribbon icon for stream "${stream.name}" (ID: ${stream.id})`);

        const iconEl = this.getPlugin().addRibbonIcon(
            stream.icon,
            `Open today for ${stream.name}`,
            () => {
                const command = new OpenTodayStreamCommand(
                    this.getPlugin().app,
                    stream,
                    this.getSettings().reuseCurrentTab
                );
                command.execute();
            }
        );

        // Tag the icon for robust identification and removal
        iconEl.addClass('streams-ribbon-icon');
        iconEl.setAttribute('data-stream-id', stream.id);

        this.log(`[RibbonService-${this.instanceId}] Created icon element: ${iconEl.outerHTML}`);

        streamIcons.today = iconEl;

        // Final policing pass
        this.enforceRibbonConsistency();
    }

    private removeStreamIcons(streamId: string): void {
        this.log(`[RibbonService-${this.instanceId}] removeStreamIcons called for ${streamId}`);
        if (!streamId) return;

        // Try to find stream name for better ghost busting
        let streamName = '';
        const stream = this.getStreams().find(s => s.id === streamId);
        if (stream) {
            streamName = stream.name;
        }

        // 1. Remove tracked icon
        const streamIcons = this.ribbonIconsByStream.get(streamId);
        if (streamIcons) {
            if (streamIcons.today) {
                streamIcons.today.remove();
                streamIcons.today = undefined;
            }
            this.ribbonIconsByStream.delete(streamId);
        }

        // 2. Remove any "ghost" icons from the DOM
        this.enforceRibbonConsistency();
    }

    private enforceRibbonConsistency(): void {
        this.log(`[RibbonService-${this.instanceId}] Enforcing ribbon consistency...`);

        const streams = this.getStreams();
        // Set of IDs that are ALLOWED to have an icon
        const allowedStreamIds = new Set(
            streams.filter(s => s.showTodayInRibbon && !s.disabled).map(s => s.id)
        );

        // Map Name -> ID for looking up untagged icons
        const nameToId = new Map(streams.map(s => [s.name, s.id]));

        // 1. Scan ALL icons that look like ours (tagged)
        const taggedIcons = document.querySelectorAll('.streams-ribbon-icon');
        taggedIcons.forEach(icon => {
            const streamId = icon.getAttribute('data-stream-id');
            if (streamId) {
                // Is this stream allowed to be visible?
                if (!allowedStreamIds.has(streamId)) {
                    this.log(`[RibbonService-${this.instanceId}] Policing: Removing hidden stream icon (ID: ${streamId})`);
                    icon.remove();
                    return;
                }

                // It IS allowed, but is it the "Blessed" instance?
                // If we have multiple icons for the same valid stream, only the tracked one survives.
                const tracked = this.ribbonIconsByStream.get(streamId)?.today;
                if (tracked && tracked !== icon) {
                    this.log(`[RibbonService-${this.instanceId}] Policing: Removing duplicate/stale icon for valid stream (ID: ${streamId})`);
                    icon.remove();
                } else if (!tracked) {
                    // It's allowed, but we aren't tracking it? 
                    // This creates a dilemma. If we are just initializing, we might not have tracked it yet.
                    // But we called 'createStreamIcons' which sets tracking.
                    // So if it's untracked, it's a ghost.
                    this.log(`[RibbonService-${this.instanceId}] Policing: Removing untracked ghost icon for valid stream (ID: ${streamId})`);
                    icon.remove();
                }
            } else {
                // Has class but no ID? Suspicious. Remove.
                this.log(`[RibbonService-${this.instanceId}] Policing: Removing malformed icon`);
                icon.remove();
            }
        });

        // 2. Scan ALL ribbon actions for untagged "Islanders"
        const allActions = document.querySelectorAll('.side-dock-ribbon-action');
        allActions.forEach(icon => {
            // Skip if it's already processed as tagged (optimization)
            if (icon.classList.contains('streams-ribbon-icon')) return;

            const label = icon.getAttribute('aria-label');
            if (label && label.startsWith('Open today for ')) {
                const streamName = label.substring('Open today for '.length);
                const streamId = nameToId.get(streamName);

                if (streamId) {
                    // We found a match in our streams!
                    // Since it is NOT tagged (we checked class), it is definitely a Ghost/Legacy icon.
                    // We REMOVE it always, because any valid icon MUST be tagged by now.
                    this.log(`[RibbonService-${this.instanceId}] Policing: Removing legacy untagged icon for "${streamName}"`);
                    icon.remove();
                }
            }
        });
    }

    private removeAllRibbonIcons(): void {
        this.log(`[RibbonService-${this.instanceId}] removeAllRibbonIcons calling. Count: ${this.ribbonIconsByStream.size}`);

        // 1. Clear tracked icons
        for (const [id, streamIcons] of this.ribbonIconsByStream.entries()) {
            if (streamIcons.today) {
                streamIcons.today.remove();
            }
        }
        this.ribbonIconsByStream.clear();

        // 2. Sweep the DOM for any remaining icons with our class
        const remainingIcons = document.querySelectorAll('.streams-ribbon-icon');
        remainingIcons.forEach(icon => icon.remove());
    }

    public updateAllRibbonIcons(): void {
        this.log(`[RibbonService-${this.instanceId}] updateAllRibbonIcons called (Diff Strategy)`);
        // Log stack trace to identify caller
        try {
            throw new Error('Ribbon Update Trace');
        } catch (e: any) {
            this.log(`[RibbonService-${this.instanceId}] Triggered by: ${e.stack}`);
        }

        const streams = this.getStreams();
        const activeStreamIds = new Set<string>();

        // 1. Process all streams: Ensure they are in correct state
        streams.forEach(stream => {
            activeStreamIds.add(stream.id);
            this.createStreamIcons(stream); // createStreamIcons now handles both create and remove-if-hidden
        });

        // 2. Remove icons for streams that no longer exist in settings (deleted)
        for (const trackedId of this.ribbonIconsByStream.keys()) {
            if (!activeStreamIds.has(trackedId)) {
                this.log(`[RibbonService-${this.instanceId}] Removing orphan icons for stream ${trackedId}`);
                this.removeStreamIcons(trackedId);
            }
        }

        // Final Policing to catch any discrepancies
        this.enforceRibbonConsistency();
    }

    private initializeStreamCommands(): void {
        this.getStreams().forEach(stream => {
            this.updateStreamCommands(stream);
        });
    }

    private updateStreamCommands(stream: Stream): void {
        if (!stream || !stream.id) return;

        if (stream.addCommand && !stream.disabled) {
            this.addStreamCommand(stream);
        } else {
            this.removeStreamCommand(stream.id);
        }
    }

    private addStreamCommand(stream: Stream): void {
        // Remove existing command if it exists
        this.removeStreamCommand(stream.id);

        const commandId = `open-today-${stream.id}`;

        this.getPlugin().addCommand({
            id: commandId,
            name: `Open today for ${stream.name}`,
            callback: () => {
                const command = new OpenTodayStreamCommand(
                    this.getPlugin().app,
                    stream,
                    this.getSettings().reuseCurrentTab
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

}
