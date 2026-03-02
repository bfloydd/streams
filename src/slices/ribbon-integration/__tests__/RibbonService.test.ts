import { RibbonService } from '../RibbonService';
import { Stream, StreamsSettings } from '../../../shared/types';
import { Plugin } from 'obsidian';

// Mock dependencies
jest.mock('../../../shared/EventBus', () => ({
    eventBus: {
        subscribe: jest.fn(),
        emit: jest.fn()
    },
    EVENTS: {
        STREAM_ADDED: 'STREAM_ADDED',
        STREAM_UPDATED: 'STREAM_UPDATED',
        STREAM_REMOVED: 'STREAM_REMOVED',
        SETTINGS_CHANGED: 'SETTINGS_CHANGED'
    }
}));

describe('RibbonService', () => {
    let ribbonService: RibbonService;
    let mockPlugin: any;
    let mockApp: any;
    let mockSettings: StreamsSettings;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';

        // Mock App
        mockApp = {};

        // Mock Settings
        mockSettings = {
            streams: [],
            primaryStreamId: null,
            barStyle: 'default',
            reuseCurrentTab: false,
            // ... other settings as needed ...
        } as any;

        // Mock Plugin
        mockPlugin = {
            app: mockApp,
            settings: mockSettings,
            addRibbonIcon: jest.fn().mockImplementation((icon, title, callback) => {
                const el = document.createElement('div');
                el.className = 'side-dock-ribbon-action';
                el.setAttribute('aria-label', title);

                // Mock Obsidian DOM extension methods
                (el as any).addClass = (cls: string) => el.classList.add(cls);
                (el as any).removeClass = (cls: string) => el.classList.remove(cls);
                (el as any).toggleClass = (cls: string, toggle: boolean) => el.classList.toggle(cls, toggle);

                document.body.appendChild(el);
                return el;
            }),
            addCommand: jest.fn(),
            saveSettings: jest.fn(),
        };

        ribbonService = new RibbonService();
        ribbonService.setPlugin(mockPlugin as any);
    });

    afterEach(() => {
        ribbonService.cleanup();
        jest.clearAllMocks();
    });

    describe('enforceRibbonConsistency (Policing)', () => {
        it('should remove icons for disabled streams', async () => {
            // Setup: Create a ghost icon for a disabled stream
            const ghostIcon = document.createElement('div');
            ghostIcon.className = 'streams-ribbon-icon';
            ghostIcon.setAttribute('data-stream-id', 'disabled-stream');
            document.body.appendChild(ghostIcon);

            // Configure settings: Stream exists but is disabled
            const disabledStream: Stream = {
                id: 'disabled-stream',
                name: 'Disabled Stream',
                icon: 'calendar',
                


                showTodayInRibbon: true,
                disabled: true, // DISABLED
                addCommand: false,
                encryptThisStream: false,
            dateFormat: 'YYYY-MM-DD',
            };
            mockSettings.streams = [disabledStream];

            // Act: Run update (triggers policing)
            ribbonService.updateAllRibbonIcons();

            // Assert: Icon should be gone
            expect(document.body.contains(ghostIcon)).toBe(false);
        });

        it('should remove icons for hidden streams (showTodayInRibbon: false)', async () => {
            // Setup: Create a ghost icon
            const ghostIcon = document.createElement('div');
            ghostIcon.className = 'streams-ribbon-icon';
            ghostIcon.setAttribute('data-stream-id', 'hidden-stream');
            document.body.appendChild(ghostIcon);

            // Configure settings: Stream exists but hidden
            const hiddenStream: Stream = {
                id: 'hidden-stream',
                name: 'Hidden Stream',
                icon: 'calendar',
                


                showTodayInRibbon: false, // HIDDEN
                disabled: false,
                addCommand: false,
                encryptThisStream: false,
            dateFormat: 'YYYY-MM-DD',
            };
            mockSettings.streams = [hiddenStream];

            // Act
            ribbonService.updateAllRibbonIcons();

            // Assert
            expect(document.body.contains(ghostIcon)).toBe(false);
        });

        it('should remove icons for non-existent streams (pure ghosts)', async () => {
            const ghostIcon = document.createElement('div');
            ghostIcon.className = 'streams-ribbon-icon';
            ghostIcon.setAttribute('data-stream-id', 'unknown-stream');
            document.body.appendChild(ghostIcon);

            mockSettings.streams = [];

            ribbonService.updateAllRibbonIcons();

            expect(document.body.contains(ghostIcon)).toBe(false);
        });

        it('should remove legacy untagged icons by name', async () => {
            // Setup: Create an untagged icon with aria-label
            const ancientIcon = document.createElement('div');
            ancientIcon.className = 'side-dock-ribbon-action'; // Classic obsidian class
            ancientIcon.setAttribute('aria-label', 'Open today for Legacy Stream');
            document.body.appendChild(ancientIcon);

            // Settings: Stream exists but is hidden (so it should strip the icon)
            const legacyStream: Stream = {
                id: 'legacy-stream',
                name: 'Legacy Stream',
                icon: 'calendar',
                


                showTodayInRibbon: false, // Should NOT be there
                disabled: false,
                addCommand: false,
                encryptThisStream: false,
            dateFormat: 'YYYY-MM-DD',
            };
            mockSettings.streams = [legacyStream];

            ribbonService.updateAllRibbonIcons();

            expect(document.body.contains(ancientIcon)).toBe(false);
        });

        it('should KEEP valid icons', async () => {
            const validStream: Stream = {
                id: 'valid-stream',
                name: 'Valid Stream',
                icon: 'calendar',
                


                showTodayInRibbon: true,
                disabled: false,
                addCommand: false,
                encryptThisStream: false,
            dateFormat: 'YYYY-MM-DD',
            };
            mockSettings.streams = [validStream];

            // Act: Create icons normally
            ribbonService.updateAllRibbonIcons();

            // Assert: Document should have 1 icon
            const icons = document.querySelectorAll('.streams-ribbon-icon');
            expect(icons.length).toBe(1);
            expect(icons[0].getAttribute('data-stream-id')).toBe('valid-stream');
        });

        it('should remove duplicate/stale icons for valid streams', async () => {
            const validStream: Stream = {
                id: 'valid-stream',
                name: 'Valid Stream',
                icon: 'calendar',
                


                showTodayInRibbon: true,
                disabled: false,
                addCommand: false,
                encryptThisStream: false,
            dateFormat: 'YYYY-MM-DD',
            };
            mockSettings.streams = [validStream];

            // Helper to spy on creation
            // We want to simulate a situation where an extra icon exists.

            // 1. Manually inject a "stale" icon for this stream
            const staleIcon = document.createElement('div');
            staleIcon.className = 'streams-ribbon-icon';
            staleIcon.setAttribute('data-stream-id', 'valid-stream');
            staleIcon.innerHTML = 'old';
            document.body.appendChild(staleIcon);

            // 2. Run update. This will create a NEW icon (the "Blessed" one)
            // and the Policeman should delete the OLD one.
            ribbonService.updateAllRibbonIcons();

            const icons = document.querySelectorAll('.streams-ribbon-icon');

            // Should have 1 icon (the new one)
            expect(icons.length).toBe(1);

            // The surviving icon should NOT be the stale one
            expect(icons[0]).not.toBe(staleIcon);
            expect(icons[0].innerHTML).not.toBe('old');
        });
    });
});
