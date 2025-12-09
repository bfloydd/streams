import { App, Modal, Setting, TextComponent, getIconIds, setIcon } from 'obsidian';
import { LucideIcon } from '../../shared/types';

export class IconPickerModal extends Modal {
    private onChoose: (icon: LucideIcon) => void;
    private currentIcon: string;
    private searchQuery: string = '';
    private iconGrid: HTMLElement;
    private allIcons: string[];

    constructor(app: App, currentIcon: string, onChoose: (icon: LucideIcon) => void) {
        super(app);
        this.currentIcon = currentIcon;
        this.onChoose = onChoose;
        this.allIcons = getIconIds();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('streams-icon-picker-modal');

        // Header and Search
        const header = contentEl.createDiv('streams-icon-picker-header');
        header.createEl('h2', { text: 'Select Icon' });

        const searchContainer = header.createDiv('streams-search-container');
        new TextComponent(searchContainer)
            .setPlaceholder('Search icons...')
            .setValue(this.searchQuery)
            .onChange((value) => {
                this.searchQuery = value.toLowerCase();
                this.renderIcons();
            });

        // Icon Grid
        this.iconGrid = contentEl.createDiv('streams-icon-picker-grid');
        this.renderIcons();
    }

    private renderIcons() {
        this.iconGrid.empty();

        const filteredIcons = this.allIcons.filter(icon =>
            icon.toLowerCase().includes(this.searchQuery)
        );

        filteredIcons.forEach(icon => {
            const iconItem = this.iconGrid.createDiv('streams-icon-item');
            if (icon === this.currentIcon) {
                iconItem.addClass('selected');
            }

            const iconContainer = iconItem.createDiv('streams-icon-preview');
            setIcon(iconContainer, icon);

            iconItem.setAttribute('aria-label', icon);

            iconItem.addEventListener('click', () => {
                this.onChoose(icon as LucideIcon);
                this.close();
            });
        });

        if (filteredIcons.length === 0) {
            this.iconGrid.createDiv('streams-no-icons').setText('No icons found');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
