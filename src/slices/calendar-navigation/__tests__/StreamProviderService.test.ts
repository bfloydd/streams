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
            dateFormat: 'YYYY-MM-DD',
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
            dateFormat: 'YYYY-MM-DD',
                disabled: false
            }
        ];

        mockDefaultStream = mockStreams[0];


        // Mock the StreamDataService
        streamDataService = new StreamDataService(jest.fn()) as jest.Mocked<StreamDataService>;
        streamDataService.getStreams.mockReturnValue(mockStreams);
        streamDataService.getDefaultStream.mockReturnValue(mockDefaultStream);


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
            dateFormat: 'YYYY-MM-DD',
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
            dateFormat: 'YYYY-MM-DD',
                disabled: false
            });
            expect(streamDataService.getDefaultStream).toHaveBeenCalledTimes(1);
        });
    });


});
