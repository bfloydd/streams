import { App, Modal, Setting } from 'obsidian';
import { Stream } from '../../shared/types';

export class StreamSelectionModal extends Modal {
    private streams: Stream[];
    private onChoose: (stream: Stream | null) => void;

    constructor(app: App, streams: Stream[], onChoose: (stream: Stream | null) => void) {
        super(app);
        this.streams = streams;
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Select stream' });

        this.streams.forEach(stream => {
            new Setting(contentEl)
                .setName(stream.name)
                .setDesc(stream.folder)
                .addButton(button => button
                    .setButtonText('Select')
                    .onClick(() => {
                        this.onChoose(stream);
                        this.close();
                    }));
        });

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Cancel')
                .onClick(() => {
                    this.onChoose(null);
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 