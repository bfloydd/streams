import { StreamProviderService } from '../StreamProviderService';
import { StreamDataService } from '../StreamDataService';
import { Stream } from '../../../shared/types';

// Mock StreamDataService
jest.mock('../StreamDataService');

describe('StreamProviderService', () => {
    let streamDataService: jest.Mocked<StreamDataService>;
    let streamProviderService: StreamProviderService;
    let mockStreams: Stream[];
    let mockDefaultStream: Stream;
    let mockActiveStream: Stream;

    beforeEach(() => {
        // Create mock streams
        mockStreams = [
            {
                id: 'stream1',
                name: 'Stream 1',
                icon: 'book',
                folder: 'Streams/Stream1',
                showTodayInRibbon: true,
                addCommand: true,
                encryptThisStream: false,
                disabled: false
            },
            {
                id: 'stream2',
                name: 'Stream 2',
                icon: 'calendar',
                folder: 'Streams/Stream2',
                showTodayInRibbon: false,
                addCommand: false,
                encryptThisStream: true,
                disabled: false
            }
        ];

        mockDefaultStream = mockStreams[0];
        mockActiveStream = mockStreams[1];

        // Mock the StreamDataService
        streamDataService = new StreamDataService(jest.fn()) as jest.Mocked<StreamDataService>;
        streamDataService.getStreams.mockReturnValue(mockStreams);
        streamDataService.getDefaultStream.mockReturnValue(mockDefaultStream);
        streamDataService.getActiveStream.mockReturnValue(mockActiveStream);

        // Create the service under test
        streamProviderService = new StreamProviderService(streamDataService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getStreams', () => {
        it('should return all streams from StreamDataService', () => {
            const result = streamProviderService.getStreams();

            expect(result).toBe(mockStreams);
            expect(streamDataService.getStreams).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no streams available', () => {
            streamDataService.getStreams.mockReturnValue([]);

            const result = streamProviderService.getStreams();

            expect(result).toEqual([]);
            expect(streamDataService.getStreams).toHaveBeenCalledTimes(1);
        });
    });

    describe('getDefaultStream', () => {
        it('should return default stream from StreamDataService', () => {
            const result = streamProviderService.getDefaultStream();

            expect(result).toBe(mockDefaultStream);
            expect(streamDataService.getDefaultStream).toHaveBeenCalledTimes(1);
        });

        it('should return fallback stream when StreamDataService returns null', () => {
            streamDataService.getDefaultStream.mockReturnValue(null as any);

            const result = streamProviderService.getDefaultStream();

            expect(result).toEqual({
                id: 'default',
                name: 'Default Stream',
                icon: 'book',
                folder: 'Streams',
                showTodayInRibbon: true,
                addCommand: true,
                encryptThisStream: false,
                disabled: false
            });
            expect(streamDataService.getDefaultStream).toHaveBeenCalledTimes(1);
        });

        it('should return fallback stream when StreamDataService returns undefined', () => {
            streamDataService.getDefaultStream.mockReturnValue(undefined as any);

            const result = streamProviderService.getDefaultStream();

            expect(result).toEqual({
                id: 'default',
                name: 'Default Stream',
                icon: 'book',
                folder: 'Streams',
                showTodayInRibbon: true,
                addCommand: true,
                encryptThisStream: false,
                disabled: false
            });
            expect(streamDataService.getDefaultStream).toHaveBeenCalledTimes(1);
        });
    });

    describe('getActiveStream', () => {
        it('should return active stream from StreamDataService', () => {
            const result = streamProviderService.getActiveStream();

            expect(result).toBe(mockActiveStream);
            expect(streamDataService.getActiveStream).toHaveBeenCalledTimes(1);
        });

        it('should return undefined when no active stream', () => {
            streamDataService.getActiveStream.mockReturnValue(undefined);

            const result = streamProviderService.getActiveStream();

            expect(result).toBeUndefined();
            expect(streamDataService.getActiveStream).toHaveBeenCalledTimes(1);
        });

        it('should return null when StreamDataService returns null', () => {
            streamDataService.getActiveStream.mockReturnValue(null as any);

            const result = streamProviderService.getActiveStream();

            expect(result).toBeNull();
            expect(streamDataService.getActiveStream).toHaveBeenCalledTimes(1);
        });
    });
});