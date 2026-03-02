import { App, PluginSettingTab, Setting, Notice, ButtonComponent } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/BaseSlice';
import { Stream, StreamsSettings, LucideIcon } from '../../shared/types';
import { StreamsPluginInterface, SettingsManager, UIController, LogProvider } from '../../shared/interfaces';
import { eventBus, EVENTS } from '../../shared/EventBus';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { configurationService } from '../../shared/ConfigurationService';
import { MeldDetectionService } from '../../slices/meld-integration';
import { IconPickerModal } from './IconPickerModal';
import { resolveStreamFilePath } from '../file-operations/streamUtils';

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

                    // Toggle Plugin Logger
                    if (this.logProvider.log) {
                        if (value) {
                            this.logProvider.log.on();
                        } else {
                            this.logProvider.log.off();
                        }
                    }

                    // Toggle Centralized Logger (used by slices)
                    if (value) {
                        centralizedLogger.enable();
                    } else {
                        centralizedLogger.disable();
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
            .setName('Primary stream')
            .setDesc('Used by the "Go to primary stream" command')
            .addDropdown(dropdown => {
                const current = this.settingsManager.settings.primaryStreamId ?? '';

                dropdown.addOption('', 'Not set');

                // Only offer enabled streams; primary stream must be a single usable stream.
                this.settingsManager.settings.streams
                    .filter(s => !s.disabled)
                    .forEach(stream => dropdown.addOption(stream.id, stream.name));

                dropdown.setValue(current);

                dropdown.onChange(async (value) => {
                    this.settingsManager.settings.primaryStreamId = value ? value : null;
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                });
            });

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
                        disabled: false,
                        dateFormat: 'YYYY-MM-DD'
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
                'title': 'Move stream up',
                'type': 'button'
            }
        });
        if (index === 0) upButton.disabled = true;
        upButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.moveStreamUp(index);
        });

        // Move down button - create simple HTML button
        const downButton = reorderContainer.createEl('button', {
            cls: 'streams-reorder-btn streams-caret-down',
            attr: {
                'data-action': 'move-down',
                'title': 'Move stream down',
                'type': 'button'
            }
        });
        if (index === this.settingsManager.settings.streams.length - 1) downButton.disabled = true;
        downButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.moveStreamDown(index);
        });

        // Add status toggle
        const statusToggle = reorderContainer.createEl('button', {
            cls: `streams-status-toggle ${stream.disabled ? 'is-disabled' : 'is-enabled'}`,
            text: stream.disabled ? 'DISABLED' : 'ENABLED',
            attr: {
                'title': stream.disabled ? 'Click to enable stream' : 'Click to disable stream',
                'type': 'button'
            }
        });

        statusToggle.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const newValue = !stream.disabled;
            stream.disabled = newValue;

            if (newValue && this.settingsManager.settings.primaryStreamId === stream.id) {
                this.settingsManager.settings.primaryStreamId = null;
                new Notice('Primary stream was disabled and has been cleared.');
            }

            await this.settingsManager.saveSettings();
            eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');

            // Update DOM directly instead of calling this.display() to prevent losing focus
            statusToggle.className = `streams-status-toggle ${stream.disabled ? 'is-disabled' : 'is-enabled'}`;
            statusToggle.textContent = stream.disabled ? 'DISABLED' : 'ENABLED';
            statusToggle.title = stream.disabled ? 'Click to enable stream' : 'Click to disable stream';

            if (stream.disabled) {
                card.addClass('streams-plugin-card-disabled');
            } else {
                card.removeClass('streams-plugin-card-disabled');
            }

            requestAnimationFrame(() => {
                eventBus.emit(EVENTS.STREAM_UPDATED, { stream: stream }, 'settings-management');
            });
        });

        return card;
    }

    private addStreamSettings(container: HTMLElement, stream: Stream, index: number): void {
        // Stream name
        new Setting(container)
            .setClass('streams-setting-stacked')
            .setName('Stream name')
            .addText(text => text
                .setValue(stream.name)
                .onChange(async (value) => {
                    stream.name = value;
                    await this.settingsManager.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                    eventBus.emit(EVENTS.STREAM_UPDATED, { stream: stream }, 'settings-management');
                }));

        // File path template
        const dateFormatDesc = document.createDocumentFragment();
        dateFormatDesc.append(
            'Advanced path support, i.e.:',
            document.createElement('br'),
            document.createElement('br'),
            '/path/{YYYY-MM-DD}',
            document.createElement('br'),
            '/path/{YYYY}/{MM}/{DD}',
            document.createElement('br'),
            '/path/{YYYY}/deeper/{MM}/{DD}',
            document.createElement('br'),
            document.createElement('br')
        );

        const previewSpan = document.createElement('strong');
        previewSpan.textContent = resolveStreamFilePath(stream, new Date());
        dateFormatDesc.append(
            'Preview: ',
            document.createElement('br'),
            previewSpan,
            document.createElement('br'),
            document.createElement('br'),
            document.createElement('i').appendChild(document.createTextNode('*YYYY, MM, and DD must all be present'))
        );

        new Setting(container)
            .setClass('streams-setting-stacked')
            .setName('File path template')
            .setDesc(dateFormatDesc)
            .addText(text => {
                const settingInput = text.inputEl;
                text.setValue(stream.dateFormat || 'YYYY-MM-DD')
                    .setPlaceholder('my/folder/{YYYY-MM-DD}')
                    .onChange(async (value) => {
                        const missingTokens = [];
                        if (!value.includes('YYYY')) missingTokens.push('YYYY');
                        if (!value.includes('MM')) missingTokens.push('MM');
                        if (!value.includes('DD')) missingTokens.push('DD');

                        if (missingTokens.length > 0) {
                            // Invalid format, visually indicate error
                            settingInput.style.borderColor = 'var(--text-error)';
                            const tokenString = missingTokens.join(', ');
                            previewSpan.textContent = `Error: Missing required tokens (${tokenString})!`;
                            previewSpan.style.color = 'var(--text-error)';
                            return; // PREVENT SAVE
                        }

                        // Valid format, clear errors
                        settingInput.style.borderColor = '';
                        previewSpan.style.color = '';

                        stream.dateFormat = value;
                        previewSpan.textContent = resolveStreamFilePath(stream, new Date());

                        await this.settingsManager.saveSettings();
                        eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                        eventBus.emit(EVENTS.STREAM_UPDATED, { stream: stream }, 'settings-management');
                    });
            });

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
                                eventBus.emit(EVENTS.STREAM_UPDATED, { stream: stream }, 'settings-management');
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
                    eventBus.emit(EVENTS.STREAM_UPDATED, { stream: stream }, 'settings-management');
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
                    // Use STREAM_UPDATED for granular updates (avoiding full ribbon rebuilds)
                    eventBus.emit(EVENTS.STREAM_UPDATED, { stream: stream }, 'settings-management');
                }));

        // Encrypt this stream
        this.addEncryptionToggle(container, stream);

        // Remove stream
        const removeContainer = container.createDiv('streams-remove-button-container');
        removeContainer.style.marginTop = '1em';
        removeContainer.style.marginBottom = '1em';

        new ButtonComponent(removeContainer)
            .setButtonText('Remove stream')
            .setWarning()
            .onClick(async () => {
                // If the removed stream was the primary stream, clear it.
                if (this.settingsManager.settings.primaryStreamId === stream.id) {
                    this.settingsManager.settings.primaryStreamId = null;
                    new Notice('Primary stream was removed and has been cleared.');
                }

                this.settingsManager.settings.streams.splice(index, 1);
                await this.settingsManager.saveSettings();
                eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settingsManager.settings, 'settings-management');
                this.display();
            });
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
