import { Stream } from '../../shared/types';
import { setIcon } from 'obsidian';
import { DateNavigationService } from './DateNavigationService';

/**
 * Interface for plugin that provides settings
 */
interface PluginInterface {
    settings: {
        barStyle?: 'default' | 'modern';
    };
}

/**
 * Manages component state for StreamsBarComponent
 * Extracted to follow Single Responsibility Principle
 */
export class ComponentStateManager {
    private plugin: PluginInterface | null;
    private streams: Stream[];
    private selectedStream: Stream;
    private dateNavigationService: DateNavigationService;

    constructor(
        plugin: PluginInterface | null,
        streams: Stream[],
        selectedStream: Stream,
        dateNavigationService: DateNavigationService
    ) {
        this.plugin = plugin;
        this.streams = streams;
        this.selectedStream = selectedStream;
        this.dateNavigationService = dateNavigationService;
    }

    /**
     * Get the display name for the active stream
     */
    getDisplayStreamName(): string {
        return this.selectedStream.name;
    }

    /**
     * Get the active stream ID
     */
    getActiveStreamId(): string {
        return this.selectedStream.id;
    }

    /**
     * Get the active stream
     */
    getActiveStream(): Stream {
        return this.selectedStream;
    }

    /**
     * Update the stream encryption icon in a container
     */
    updateStreamEncryptionIcon(container: HTMLElement): void {
        const activeStream = this.getActiveStream();

        // Remove existing encryption icon if it exists
        const existingIcon = container.querySelector('.streams-bar-encryption-icon');
        if (existingIcon) {
            existingIcon.remove();
        }

        // Add encryption icon if stream is encrypted
        if (activeStream.encryptThisStream) {
            const encryptionIcon = container.createDiv('streams-bar-encryption-icon');
            setIcon(encryptionIcon, 'lock');
            encryptionIcon.setAttribute('title', 'Encrypted stream');
            encryptionIcon.setAttribute('aria-label', 'Encrypted stream');
        }
    }

    /**
     * Apply bar style to a component based on settings
     */
    applyBarStyle(component: HTMLElement): void {
        if (!this.plugin?.settings) {
            return;
        }

        const barStyle = this.plugin.settings.barStyle;

        // Remove existing style classes
        component.removeClass('modern-style');

        // Apply the appropriate style class
        if (barStyle === 'modern') {
            component.addClass('modern-style');
        }
    }

    /**
     * Format the today button text based on the current date
     */
    formatTodayButtonText(currentDate: Date): string {
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDay = today.getDate();

        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const currentDay = currentDate.getDate();

        if (currentYear === todayYear && currentMonth === todayMonth && currentDay === todayDay) {
            return 'TODAY';
        } else {
            return this.dateNavigationService.formatDate(currentDate);
        }
    }

    /**
     * Update streams list
     */
    updateStreams(streams: Stream[]): void {
        this.streams = streams;
    }

    /**
     * Update selected stream
     */
    updateSelectedStream(stream: Stream): void {
        this.selectedStream = stream;
    }
}

