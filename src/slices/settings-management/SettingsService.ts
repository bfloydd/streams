import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { Stream, StreamsSettings, LucideIcon } from '../../shared/types';
import { StreamsPluginInterface } from '../../shared/interfaces';
import { eventBus, EVENTS } from '../../shared/event-bus';

export class SettingsService extends SettingsAwareSliceService {
    private settingsTab: StreamsSettingTab | null = null;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Create and register the settings tab
        this.settingsTab = new StreamsSettingTab(this.getPlugin().app, this.getPlugin() as any);
        this.getPlugin().addSettingTab(this.settingsTab);

        this.initialized = true;
    }

    cleanup(): void {
        // Settings tab cleanup is handled by Obsidian
        this.settingsTab = null;
        this.initialized = false;
    }

    onSettingsChanged(settings: StreamsSettings): void {
        // Notify other services about settings changes
        this.notifySettingsChanged(settings);
    }

    private notifySettingsChanged(settings: StreamsSettings): void {
        // This will be used to notify other services when settings change
        // For now, we'll implement this when we add event broadcasting
        console.log('Settings changed:', settings);
    }

    /**
     * Get current settings
     */
    getSettings(): StreamsSettings {
        return this.getSettings();
    }

    /**
     * Save settings
     */
    async saveSettings(): Promise<void> {
        await this.saveSettings();
    }
}

export class StreamsSettingTab extends PluginSettingTab {
    plugin: StreamsPluginInterface;

    constructor(app: App, plugin: StreamsPluginInterface) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Show calendar component')
            .setDesc('Show the calendar component on all notes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCalendarComponent)
                .onChange(async (value) => {
                    this.plugin.settings.showCalendarComponent = value;
                    await this.plugin.saveSettings();
                    
                    // Emit event to update all components
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                    
                    new Notice(`Calendar component ${value ? 'shown' : 'hidden'}`);
                }));
                
        new Setting(containerEl)
            .setName('Reuse current tab for calendar navigation')
            .setDesc('When enabled, calendar navigation will reuse the current tab instead of opening new tabs')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.reuseCurrentTab)
                .onChange(async (value) => {
                    this.plugin.settings.reuseCurrentTab = value;
                    await this.plugin.saveSettings();
                    
                    new Notice(`Calendar navigation will ${value ? 'reuse' : 'open new'} tabs`);
                }));
                
        new Setting(containerEl)
            .setName('Enable debug logging')
            .setDesc('Enable debug logging for the Streams plugin (can also be toggled via command palette)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugLoggingEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.debugLoggingEnabled = value;
                    
                    // Apply the setting immediately
                    if (value) {
                        this.plugin.log.on();
                    } else {
                        this.plugin.log.off();
                    }
                    
                    await this.plugin.saveSettings();
                    
                    new Notice(`Debug logging ${value ? 'enabled' : 'disabled'}`);
                }));
                
        new Setting(containerEl).setName('Streams').setHeading();

        new Setting(containerEl)
            .setName('Add stream')
            .setDesc('Create a new note stream')
            .addButton(button => button
                .setButtonText('Add stream')
                .setCta()
                .onClick(async () => {
                    const newStream: Stream = {
                        id: crypto.randomUUID(),
                        name: 'New Stream',
                        folder: '',
                        icon: 'file-text' as LucideIcon,
                        showTodayInRibbon: true,
                        addCommand: false
                    };
                    this.plugin.settings.streams.push(newStream);
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                    this.display();
                }));

        const streamsContainer = containerEl.createDiv('streams-plugin-container');

        this.plugin.settings.streams.forEach((stream, index) => {
            const streamCard = this.createStreamCard(streamsContainer, stream, index);
            this.addStreamSettings(streamCard, stream, index);
        });
    }

    private createStreamCard(container: HTMLElement, stream: Stream, index: number): HTMLElement {
        const card = container.createDiv('streams-plugin-card');
        card.createEl('h3', { text: stream.name });
        return card;
    }

    private addStreamSettings(container: HTMLElement, stream: Stream, index: number): void {
        // Stream name
        new Setting(container)
            .setName('Stream name')
            .setDesc('Name of the stream')
            .addText(text => text
                .setValue(stream.name)
                .onChange(async (value) => {
                    stream.name = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                }));

        // Stream folder
        new Setting(container)
            .setName('Folder')
            .setDesc('Folder where daily notes will be created')
            .addText(text => text
                .setValue(stream.folder)
                .onChange(async (value) => {
                    stream.folder = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                }));

        // Show today in ribbon
        new Setting(container)
            .setName('Show today button in ribbon')
            .setDesc('Show a today button for this stream in the ribbon')
            .addToggle(toggle => toggle
                .setValue(stream.showTodayInRibbon)
                .onChange(async (value) => {
                    stream.showTodayInRibbon = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                }));

        // Add command
        new Setting(container)
            .setName('Add command')
            .setDesc('Add a command for this stream')
            .addToggle(toggle => toggle
                .setValue(stream.addCommand)
                .onChange(async (value) => {
                    stream.addCommand = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                }));

        // Remove stream
        new Setting(container)
            .addButton(button => button
                .setButtonText('Remove stream')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.streams.splice(index, 1);
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                    this.display();
                }));
    }
}
