import { ServiceCoordinator } from '../ServiceCoordinator';
import { StreamProviderService } from '../StreamProviderService';
import { FilePathProviderService } from '../FilePathProviderService';
import { StreamDataService } from '../StreamDataService';
import { Stream } from '../../../shared/types';

// Mock Obsidian
jest.mock('obsidian', () => ({
    Component: class MockComponent { },
    ItemView: class MockItemView { },
    WorkspaceLeaf: class MockWorkspaceLeaf { },
    PluginSettingTab: class MockPluginSettingTab { },
    Modal: class MockModal { },
    App: class MockApp {
        workspace = {
            getLeavesOfType: jest.fn(),
            activeLeaf: null,
            on: jest.fn()
        };
        vault = {
            on: jest.fn()
        };
    }
}));

describe('Calendar Navigation Integration Tests', () => {
    let serviceCoordinator: ServiceCoordinator;
    let mockPlugin: any;
    let mockSettingsManager: any;

    beforeEach(() => {
        // Create mock plugin
        mockPlugin = {
            app: new (jest.requireMock('obsidian').App)(),
            registerView: jest.fn(),
            registerEvent: jest.fn()
        };

        mockSettingsManager = {
            settings: {
                streams: [
                    {
                        id: 'test-stream',
                        name: 'Test Stream',
                        icon: 'book',
                        folder: 'Streams/Test',
                        showTodayInRibbon: true,
                        addCommand: true,
                        encryptThisStream: false,
            dateFormat: 'YYYY-MM-DD',
                        disabled: false
                    }
                ],

                showStreamsBarComponent: true,
                reuseCurrentTab: false,
                debugLoggingEnabled: false,
                barStyle: 'default' as const
            }
        };

        // Create ServiceCoordinator with mocked dependencies
        serviceCoordinator = new ServiceCoordinator();
        (serviceCoordinator as any).plugin = mockPlugin;
        (serviceCoordinator as any).getPlugin = () => mockPlugin;
        (serviceCoordinator as any).getSettingsManager = () => mockSettingsManager;
        (serviceCoordinator as any).getSettings = () => mockSettingsManager.settings;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Service Initialization Integration', () => {
        it('should initialize all services correctly and wire dependencies', async () => {
            await serviceCoordinator.initialize();

            // Verify ServiceCoordinator has all required services initialized
            expect((serviceCoordinator as any).streamDataService).toBeInstanceOf(StreamDataService);
            expect((serviceCoordinator as any).streamProviderService).toBeInstanceOf(StreamProviderService);
            expect((serviceCoordinator as any).filePathProviderService).toBeInstanceOf(FilePathProviderService);

            // Verify dependencies are properly injected
            const streamProviderService = (serviceCoordinator as any).streamProviderService as StreamProviderService;
            const filePathProviderService = (serviceCoordinator as any).filePathProviderService as FilePathProviderService;

            // Test that StreamProviderService can access streams through StreamDataService
            const streams = streamProviderService.getStreams();
            expect(streams).toEqual(mockSettingsManager.settings.streams);

            // Test that FilePathProviderService can generate paths
            const testStream = mockSettingsManager.settings.streams[0];
            const filePath = filePathProviderService.getDefaultFilePath(testStream);
            expect(typeof filePath).toBe('string');
            expect(filePath).toContain(testStream.folder);
        });

        it('should maintain backward compatibility with existing interfaces', async () => {
            await serviceCoordinator.initialize();

            const streamProviderService = (serviceCoordinator as any).streamProviderService as StreamProviderService;
            const filePathProviderService = (serviceCoordinator as any).filePathProviderService as FilePathProviderService;

            // Test StreamProvider interface methods
            expect(typeof streamProviderService.getStreams).toBe('function');
            expect(typeof streamProviderService.getDefaultStream).toBe('function');


            // Test FilePathProvider interface methods
            expect(typeof filePathProviderService.getDefaultFilePath).toBe('function');

            // Verify method calls work
            const streams = streamProviderService.getStreams();
            const defaultStream = streamProviderService.getDefaultStream();

            const filePath = filePathProviderService.getDefaultFilePath(defaultStream);

            expect(Array.isArray(streams)).toBe(true);
            expect(defaultStream).toBeDefined();
            expect(typeof filePath).toBe('string');

        });

        it('should handle service lifecycle correctly', async () => {
            await serviceCoordinator.initialize();

            // Verify initialization state
            expect((serviceCoordinator as any).initialized).toBe(true);

            // Test cleanup
            serviceCoordinator.cleanup();
            expect((serviceCoordinator as any).initialized).toBe(false);
        });

        it('should handle settings changes and propagate to components', async () => {
            await serviceCoordinator.initialize();

            const newSettings = {
                ...mockSettingsManager.settings,

            };

            // Mock component lifecycle manager methods
            const componentLifecycleManager = (serviceCoordinator as any).componentLifecycleManager;
            componentLifecycleManager.updateExistingComponentsSettings = jest.fn();
            componentLifecycleManager.updateAllStreamsBarComponents = jest.fn();

            serviceCoordinator.onSettingsChanged(newSettings);

            expect(componentLifecycleManager.updateExistingComponentsSettings).toHaveBeenCalledWith(newSettings);
            expect(componentLifecycleManager.updateAllStreamsBarComponents).toHaveBeenCalled();
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle initialization errors gracefully', async () => {
            // Mock a service that throws during initialization
            const originalInitializeServices = (serviceCoordinator as any).initializeServices;
            (serviceCoordinator as any).initializeServices = jest.fn(() => {
                throw new Error('Service initialization failed');
            });

            await expect(serviceCoordinator.initialize()).rejects.toThrow('Service initialization failed');

            // Restore original method
            (serviceCoordinator as any).initializeServices = originalInitializeServices;
        });

        it('should handle missing settings gracefully', async () => {
            (serviceCoordinator as any).getSettingsManager = () => ({
                settings: null
            });

            await serviceCoordinator.initialize();

            const streamProviderService = (serviceCoordinator as any).streamProviderService as StreamProviderService;
            const streams = streamProviderService.getStreams();

            expect(streams).toEqual([]);
        });
    });
});
