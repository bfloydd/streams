import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/BaseSlice';
import { Stream, StreamsSettings, LucideIcon } from '../../shared/types';
import { StreamsPluginInterface, SettingsManager, UIController, LogProvider } from '../../shared/interfaces';
import { eventBus, EVENTS } from '../../shared/EventBus';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { configurationService } from '../../shared/ConfigurationService';
import { MeldDetectionService } from '../../slices/meld-integration';
import { IconPickerModal } from './IconPickerModal';

export class SettingsService extends SettingsAwareSliceService {
    private settingsTab: StreamsSettingTab | null = null;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.settingsTab = new StreamsSettingTab(
            this.getPlugin().app,
            this.getSettingsManager(),
            this.getUIController(),
            this.getLogProvider()
        );
        this.getPlugin().addSettingTab(this.settingsTab);

        this.initialized = true;
    }

    cleanup(): void {
        this.settingsTab = null;
        this.initialized = false;
    }

    onSettingsChanged(settings: StreamsSettings): void {
        this.notifySettingsChanged(settings);
    }

    private notifySettingsChanged(settings: StreamsSettings): void {
        centralizedLogger.info('Settings changed');
    }

    getSettings(): StreamsSettings {
        return super.getSettings();
    }

    async saveSettings(): Promise<void> {
        await super.saveSettings();
    }
}

export class StreamsSettingTab extends PluginSettingTab {
    private settingsManager: SettingsManager;
    private uiController: UIController;
    private logProvider: LogProvider;

    constructor(app: App, settingsManager: SettingsManager, uiController: UIController, logProvider: LogProvider) {
        super(app, settingsManager as any);
        this.settingsManager = settingsManager;
        this.uiController = uiController;
        this.logProvider = logProvider;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Show streams bar component')
            .setDesc('Show the streams bar component on all notes')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.showStreamsBarComponent)
                .onChange(async (value) => {
                    this.settingsManager.settings.showStreamsBarComponent = value;
                    await this.settingsManager.saveSettings();

                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');

                    new Notice(`Streams bar component ${value ? 'shown' : 'hidden'}`);
                }));

        new Setting(containerEl)
            .setName('Reuse current tab for calendar navigation')
            .setDesc('When enabled, calendar navigation will reuse the current tab instead of opening new tabs')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.reuseCurrentTab)
                .onChange(async (value) => {
                    this.settingsManager.settings.reuseCurrentTab = value;
                    await this.settingsManager.saveSettings();

                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');

                    new Notice(`Calendar navigation will ${value ? 'reuse' : 'open new'} tabs`);
                }));

        new Setting(containerEl)
            .setName('Enable debug logging')
            .setDesc('Enable debug logging for the Streams plugin (can also be toggled via command palette)')
            .addToggle(toggle => toggle
                .setValue(this.settingsManager.settings.debugLoggingEnabled)
                .onChange(async (value) => {
                    this.settingsManager.settings.debugLoggingEnabled = value;

                    if (this.logProvider.log) {
                        if (value) {
                            this.logProvider.log.on();
                        } else {
                            this.logProvider.log.off();
                        }
                    }

                    await this.settingsManager.saveSettings();

                    new Notice(`Debug logging ${value ? 'enabled' : 'disabled'}`);
                }));

        new Setting(containerEl)
            .setName('Bar style')
            .setDesc('Choose the visual style for the streams bar component')
            .addDropdown(dropdown => dropdown
                .addOption('default', 'Default')
                .addOption('modern', 'Modern')
                .setValue(this.settingsManager.settings.barStyle)
                .onChange(async (value: 'default' | 'modern') => {
                    this.settingsManager.settings.barStyle = value;
                    await this.settingsManager.saveSettings();

                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');

                    new Notice(`Bar style changed to ${value === 'default' ? 'Default' : 'Modern'}`);
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
                        addCommand: false,
                        encryptThisStream: false,
                        disabled: false
                    };
                    this.settingsManager.settings.streams.push(newStream);
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                    this.display();
                }));

        const streamsContainer = containerEl.createDiv('streams-plugin-container');

        this.settingsManager.settings.streams.forEach((stream: Stream, index: number) => {
            const streamCard = this.createStreamCard(streamsContainer, stream, index);
            this.addStreamSettings(streamCard, stream, index);
        });
    }

    private createStreamCard(container: HTMLElement, stream: Stream, index: number): HTMLElement {
        const card = container.createDiv('streams-plugin-card');

        // Add disabled class if stream is disabled
        if (stream.disabled) {
            card.addClass('streams-plugin-card-disabled');
        }

        // Create header with title and reorder controls
        const header = card.createDiv('streams-card-header');
        const title = header.createEl('h3', { text: stream.name });

        // Add reorder controls to the header
        const reorderContainer = header.createDiv('streams-reorder-container');

        // Move up button - create simple HTML button
        const upButton = reorderContainer.createEl('button', {
            cls: 'streams-reorder-btn streams-caret-up',
            attr: {
                'data-action': 'move-up',
                'title': 'Move stream up'
            }
        });
        if (index === 0) upButton.disabled = true;
        upButton.addEventListener('click', async () => {
            await this.moveStreamUp(index);
        });

        // Move down button - create simple HTML button
        const downButton = reorderContainer.createEl('button', {
            cls: 'streams-reorder-btn streams-caret-down',
            attr: {
                'data-action': 'move-down',
                'title': 'Move stream down'
            }
        });
        if (index === this.settingsManager.settings.streams.length - 1) downButton.disabled = true;
        downButton.addEventListener('click', async () => {
            await this.moveStreamDown(index);
        });

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
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                }));

        // Stream folder
        new Setting(container)
            .setName('Folder')
            .setDesc('Folder where daily notes will be created')
            .addText(text => text
                .setValue(stream.folder)
                .onChange(async (value) => {
                    stream.folder = value;
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                }));

        // Icon
        const iconSetting = new Setting(container)
            .setName('Icon')
            .setDesc('Icon for the stream (used in ribbon and menus)')
            .addButton(button => {
                button
                    .setIcon(stream.icon)
                    .setTooltip('Select icon')
                    .onClick(() => {
                        const modal = new IconPickerModal(
                            this.app,
                            stream.icon,
                            async (newIcon) => {
                                stream.icon = newIcon;
                                button.setIcon(newIcon);
                                await this.settingsManager.saveSettings();
                                eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                            }
                        );
                        modal.open();
                    });
            });

        // Add command
        new Setting(container)
            .setName('Add command')
            .setDesc('Add a command for this stream')
            .addToggle(toggle => toggle
                .setValue(stream.addCommand)
                .onChange(async (value) => {
                    stream.addCommand = value;
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                }));

        // Show today in ribbon
        new Setting(container)
            .setName('Show in ribbon')
            .setDesc('Show a today button for this stream in the ribbon')
            .addToggle(toggle => toggle
                .setValue(stream.showTodayInRibbon)
                .onChange(async (value) => {
                    stream.showTodayInRibbon = value;
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                }));

        // Encrypt this stream
        this.addEncryptionToggle(container, stream);

        // Disable stream
        const disableSetting = new Setting(container)
            .setName('Disable stream')
            .setDesc('When disabled, this stream will be hidden from selection lists and grayed out in settings')
            .addToggle(toggle => toggle
                .setValue(stream.disabled || false)
                .onChange(async (value) => {
                    stream.disabled = value;
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');

                    // Refresh the display to update visual styling
                    this.display();

                    // Force immediate UI refresh for mobile devices
                    // Use requestAnimationFrame to ensure DOM updates are processed
                    requestAnimationFrame(() => {
                        // Emit a specific event for stream dropdown refresh
                        eventBus.emit(EVENTS.STREAM_UPDATED, { streamId: stream.id, disabled: value }, 'settings-management');
                    });
                }));

        // Add a class to identify the disable toggle for styling
        if (stream.disabled) {
            disableSetting.settingEl.addClass('streams-disable-toggle');
        }

        // Remove stream
        new Setting(container)
            .addButton(button => button
                .setButtonText('Remove stream')
                .setWarning()
                .onClick(async () => {
                    this.settingsManager.settings.streams.splice(index, 1);
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                    this.display();
                }));
    }

    private async moveStreamUp(index: number): Promise<void> {
        if (index === 0) return;

        const streams = this.settingsManager.settings.streams;
        const stream = streams[index];

        // Remove stream from current position
        streams.splice(index, 1);

        // Insert stream at new position (one position up)
        streams.splice(index - 1, 0, stream);

        await this.settingsManager.saveSettings();
        eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
        this.display();
    }

    private async moveStreamDown(index: number): Promise<void> {
        const streams = this.settingsManager.settings.streams;
        if (index === streams.length - 1) return;

        const stream = streams[index];

        // Remove stream from current position
        streams.splice(index, 1);

        // Insert stream at new position (one position down)
        streams.splice(index + 1, 0, stream);

        await this.settingsManager.saveSettings();
        eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
        this.display();
    }

    private addEncryptionToggle(container: HTMLElement, stream: Stream): void {
        // Check if Meld plugin is available
        const meldDetectionService = new MeldDetectionService();
        meldDetectionService.setPlugin(this.settingsManager as any);
        const isMeldAvailable = meldDetectionService.isMeldPluginAvailable();

        const encryptionSetting = new Setting(container)
            .setName('Encrypt this stream')
            .setDesc(isMeldAvailable
                ? 'When enabled, files created in this stream will be encrypted using the Meld plugin'
                : 'Meld plugin is not available. Please install and enable the Meld plugin to use encryption features.'
            )
            .addToggle(toggle => {
                toggle
                    .setValue(stream.encryptThisStream || false)
                    .setDisabled(!isMeldAvailable)
                    .onChange(async (value) => {
                        if (value && !isMeldAvailable) {
                            new Notice('Meld plugin is not available. Please install and enable the Meld plugin first.');
                            return;
                        }

                        stream.encryptThisStream = value;
                        await this.settingsManager.saveSettings();
                        eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');

                        new Notice(`Encryption ${value ? 'enabled' : 'disabled'} for stream "${stream.name}"`);
                    });
            });

        // Add warning if Meld is not available
        if (!isMeldAvailable) {
            const warningEl = container.createDiv('streams-encryption-warning');
            warningEl.textContent = '⚠️ Meld plugin is required for encryption features';
        }
    }
}
