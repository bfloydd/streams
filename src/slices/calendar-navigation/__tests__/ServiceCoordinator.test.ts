import { ServiceCoordinator } from '../ServiceCoordinator';
import { ViewRegistrationService } from '../ViewRegistrationService';
import { CalendarViewService } from '../CalendarViewService';
import { ComponentLifecycleManager } from '../ComponentLifecycleManager';
import { EventHandlerService } from '../EventHandlerService';
import { StreamDataService } from '../StreamDataService';
import { StreamProviderService } from '../StreamProviderService';
import { FilePathProviderService } from '../FilePathProviderService';
import { App, WorkspaceLeaf, Component } from 'obsidian';
import { StreamsSettings } from '../../../shared/types';

// Mock all dependencies
jest.mock('../ViewRegistrationService');
jest.mock('../CalendarViewService');
jest.mock('../ComponentLifecycleManager');
jest.mock('../EventHandlerService');
jest.mock('../StreamDataService');
jest.mock('../StreamProviderService');
jest.mock('../FilePathProviderService');
jest.mock('../../../shared');
jest.mock('obsidian', () => ({
    Component: class MockComponent {},
    ItemView: class MockItemView {},
    WorkspaceLeaf: class MockWorkspaceLeaf {},
    PluginSettingTab: class MockPluginSettingTab {},
    Modal: class MockModal {}
}));

describe('ServiceCoordinator', () => {
    let serviceCoordinator: ServiceCoordinator;
    let mockApp: jest.Mocked<App>;
    let mockPlugin: any;
    let mockSettingsManager: any;

    // Mock service instances
    let mockViewRegistrationService: jest.Mocked<ViewRegistrationService>;
    let mockCalendarViewService: jest.Mocked<CalendarViewService>;
    let mockComponentLifecycleManager: jest.Mocked<ComponentLifecycleManager>;
    let mockEventHandlerService: jest.Mocked<EventHandlerService>;
    let mockStreamDataService: jest.Mocked<StreamDataService>;
    let mockStreamProviderService: jest.Mocked<StreamProviderService>;
    let mockFilePathProviderService: jest.Mocked<FilePathProviderService>;

    beforeEach(() => {
        // Create mock app and plugin
        mockApp = {} as jest.Mocked<App>;
        mockPlugin = {
            app: mockApp,
            registerView: jest.fn()
        };

        mockSettingsManager = {
            settings: {
                streams: [],
                activeStreamId: 'test-stream'
            }
        };

        // Create mock services
        mockViewRegistrationService = new ViewRegistrationService(mockApp, {} as any, {} as any) as jest.Mocked<ViewRegistrationService>;
        mockCalendarViewService = new CalendarViewService() as jest.Mocked<CalendarViewService>;
        mockComponentLifecycleManager = new ComponentLifecycleManager(mockApp, mockCalendarViewService, {} as any, jest.fn(), jest.fn()) as jest.Mocked<ComponentLifecycleManager>;
        mockEventHandlerService = new EventHandlerService(mockApp) as jest.Mocked<EventHandlerService>;
        mockStreamDataService = new StreamDataService(jest.fn()) as jest.Mocked<StreamDataService>;
        mockStreamProviderService = new StreamProviderService(mockStreamDataService) as jest.Mocked<StreamProviderService>;
        mockFilePathProviderService = new FilePathProviderService(mockStreamDataService) as jest.Mocked<FilePathProviderService>;

        // Mock the methods that are called in tests
        mockComponentLifecycleManager.updateAllStreamsBarComponents = jest.fn();
        mockComponentLifecycleManager.updateExistingComponentsSettings = jest.fn();
        mockComponentLifecycleManager.updateStreamsBarComponent = jest.fn();
        mockComponentLifecycleManager.refreshAllStreamsBarComponents = jest.fn();
        mockComponentLifecycleManager.removeAllComponents = jest.fn();
        mockComponentLifecycleManager.setStreamDataService = jest.fn();

        // Mock constructors
        (ViewRegistrationService as jest.MockedClass<typeof ViewRegistrationService>).mockImplementation(() => mockViewRegistrationService);
        (CalendarViewService as jest.MockedClass<typeof CalendarViewService>).mockImplementation(() => mockCalendarViewService);
        (ComponentLifecycleManager as jest.MockedClass<typeof ComponentLifecycleManager>).mockImplementation(() => mockComponentLifecycleManager);
        (EventHandlerService as jest.MockedClass<typeof EventHandlerService>).mockImplementation(() => mockEventHandlerService);
        (StreamDataService as jest.MockedClass<typeof StreamDataService>).mockImplementation(() => mockStreamDataService);
        (StreamProviderService as jest.MockedClass<typeof StreamProviderService>).mockImplementation(() => mockStreamProviderService);
        (FilePathProviderService as jest.MockedClass<typeof FilePathProviderService>).mockImplementation(() => mockFilePathProviderService);

        // Create ServiceCoordinator with mocked plugin
        serviceCoordinator = new ServiceCoordinator();
        (serviceCoordinator as any).plugin = mockPlugin;
        (serviceCoordinator as any).getPlugin = () => mockPlugin;
        (serviceCoordinator as any).getSettingsManager = () => mockSettingsManager;
        (serviceCoordinator as any).getSettings = () => mockSettingsManager.settings;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize services correctly', async () => {
            await serviceCoordinator.initialize();

            expect(serviceCoordinator['streamDataService']).toBeInstanceOf(StreamDataService);
            expect(serviceCoordinator['streamProviderService']).toBeInstanceOf(StreamProviderService);
            expect(serviceCoordinator['filePathProviderService']).toBeInstanceOf(FilePathProviderService);
            expect(serviceCoordinator['viewRegistrationService']).toBeInstanceOf(ViewRegistrationService);
            expect(serviceCoordinator['calendarViewService']).toBeInstanceOf(CalendarViewService);
            expect(serviceCoordinator['componentLifecycleManager']).toBeInstanceOf(ComponentLifecycleManager);
            expect(serviceCoordinator['eventHandlerService']).toBeInstanceOf(EventHandlerService);
        });

        it('should register plugin views', async () => {
            const mockRegisterView = jest.fn();
            mockViewRegistrationService.registerPluginViews = jest.fn().mockImplementation((callbacks) => {
                callbacks.registerView('test-view', jest.fn());
            });

            await serviceCoordinator.initialize();

            expect(mockViewRegistrationService.registerPluginViews).toHaveBeenCalledWith({
                registerView: expect.any(Function)
            });
        });

        it('should register event handlers', async () => {
            await serviceCoordinator.initialize();

            expect(mockEventHandlerService.registerEvents).toHaveBeenCalledWith(mockPlugin);
        });

        it('should refresh components after initialization delay', async () => {
            jest.useFakeTimers();

            await serviceCoordinator.initialize();

            expect(mockComponentLifecycleManager.refreshAllStreamsBarComponents).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);

            expect(mockComponentLifecycleManager.refreshAllStreamsBarComponents).toHaveBeenCalledTimes(1);

            jest.useRealTimers();
        });
    });

    describe('settings changes', () => {
        beforeEach(async () => {
            await serviceCoordinator.initialize();
        });

        it('should update existing components when settings change', () => {
            const newSettings: StreamsSettings = {
                streams: [],
                activeStreamId: 'new-stream',
                showStreamsBarComponent: true,
                reuseCurrentTab: false,
                debugLoggingEnabled: false,
                barStyle: 'default'
            };

            serviceCoordinator.onSettingsChanged(newSettings);

            expect(mockComponentLifecycleManager.updateExistingComponentsSettings).toHaveBeenCalledWith(newSettings);
            expect(mockComponentLifecycleManager.updateAllStreamsBarComponents).toHaveBeenCalled();
        });
    });

    describe('public methods', () => {
        beforeEach(async () => {
            await serviceCoordinator.initialize();
        });

        it('should update streams bar component for a leaf', () => {
            const mockLeaf = {} as WorkspaceLeaf;

            serviceCoordinator.updateStreamsBarComponent(mockLeaf);

            expect(mockComponentLifecycleManager.updateStreamsBarComponent).toHaveBeenCalledWith(mockLeaf);
        });

        it('should update all streams bar components', () => {
            (serviceCoordinator as any).isInitializing = false;

            serviceCoordinator.updateAllStreamsBarComponents();

            expect(mockComponentLifecycleManager.updateAllStreamsBarComponents).toHaveBeenCalledTimes(1);
        });

        it('should refresh all streams bar components', () => {
            serviceCoordinator.refreshAllStreamsBarComponents();

            expect(mockComponentLifecycleManager.refreshAllStreamsBarComponents).toHaveBeenCalledTimes(1);
        });

        it('should not update all streams bar components during initialization', () => {
            (serviceCoordinator as any).isInitializing = true;

            serviceCoordinator.updateAllStreamsBarComponents();

            expect(mockComponentLifecycleManager.updateAllStreamsBarComponents).not.toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            await serviceCoordinator.initialize();
        });

        it('should remove all components on cleanup', () => {
            serviceCoordinator.cleanup();

            expect(mockComponentLifecycleManager.removeAllComponents).toHaveBeenCalledTimes(1);
            expect(serviceCoordinator['initialized']).toBe(false);
        });
    });

    describe('service coordination', () => {
        it('should properly inject dependencies into services', async () => {
            await serviceCoordinator.initialize();

            // Verify that ViewRegistrationService was created with correct dependencies
            expect(ViewRegistrationService).toHaveBeenCalledWith(
                mockApp,
                serviceCoordinator['streamProviderService'],
                serviceCoordinator['filePathProviderService']
            );

            // Verify that ComponentLifecycleManager has StreamDataService set
            expect(mockComponentLifecycleManager.setStreamDataService).toHaveBeenCalledWith(serviceCoordinator['streamDataService']);

            // Verify that EventHandlerService has dependencies set
            expect(mockEventHandlerService.setDependencies).toHaveBeenCalledWith(
                mockComponentLifecycleManager,
                expect.any(Object) // LeafInspectionService mock
            );
        });
    });
});