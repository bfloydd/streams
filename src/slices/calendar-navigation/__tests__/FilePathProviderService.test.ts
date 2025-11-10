import { FilePathProviderService } from '../FilePathProviderService';
import { StreamDataService } from '../StreamDataService';
import { Stream } from '../../../shared/types';

// Mock StreamDataService
jest.mock('../StreamDataService');

describe('FilePathProviderService', () => {
    let streamDataService: jest.Mocked<StreamDataService>;
    let filePathProviderService: FilePathProviderService;
    let mockStream: Stream;

    beforeEach(() => {
        // Create mock stream
        mockStream = {
            id: 'test-stream',
            name: 'Test Stream',
            icon: 'book',
            folder: 'Streams/Test',
            showTodayInRibbon: true,
            addCommand: true,
            encryptThisStream: false,
            disabled: false
        };

        // Mock the StreamDataService
        streamDataService = new StreamDataService(jest.fn()) as jest.Mocked<StreamDataService>;
        streamDataService.getDefaultFilePath.mockImplementation((stream: Stream) => {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const fileName = `${year}-${month}-${day}.md`;
            return `${stream.folder}/${fileName}`;
        });

        // Create the service under test
        filePathProviderService = new FilePathProviderService(streamDataService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getDefaultFilePath', () => {
        it('should return file path from StreamDataService when available', () => {
            const expectedPath = 'Streams/Test/2024-01-15.md'; // Mock today's date
            streamDataService.getDefaultFilePath.mockReturnValue(expectedPath);

            const result = filePathProviderService.getDefaultFilePath(mockStream);

            expect(result).toBe(expectedPath);
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledWith(mockStream);
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledTimes(1);
        });

        it('should return fallback path when StreamDataService returns null', () => {
            streamDataService.getDefaultFilePath.mockReturnValue(null as any);

            const result = filePathProviderService.getDefaultFilePath(mockStream);

            expect(result).toBe('Streams/Test/default.md');
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledWith(mockStream);
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledTimes(1);
        });

        it('should return fallback path when StreamDataService returns undefined', () => {
            streamDataService.getDefaultFilePath.mockReturnValue(undefined as any);

            const result = filePathProviderService.getDefaultFilePath(mockStream);

            expect(result).toBe('Streams/Test/default.md');
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledWith(mockStream);
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledTimes(1);
        });

        it('should return fallback path when StreamDataService returns empty string', () => {
            streamDataService.getDefaultFilePath.mockReturnValue('');

            const result = filePathProviderService.getDefaultFilePath(mockStream);

            expect(result).toBe('Streams/Test/default.md');
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledWith(mockStream);
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledTimes(1);
        });

        it('should handle different stream folder paths', () => {
            const streams = [
                { ...mockStream, folder: 'Daily' },
                { ...mockStream, folder: 'Journal/2024' },
                { ...mockStream, folder: 'Notes/Personal' },
                { ...mockStream, folder: '' }
            ];

            streams.forEach(stream => {
                streamDataService.getDefaultFilePath.mockReturnValue(null as any);

                const result = filePathProviderService.getDefaultFilePath(stream);
                const expectedFallback = stream.folder ? `${stream.folder}/default.md` : '/default.md';

                expect(result).toBe(expectedFallback);
                expect(streamDataService.getDefaultFilePath).toHaveBeenCalledWith(stream);
            });

            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledTimes(streams.length);
        });

        it('should handle streams with special characters in folder names', () => {
            const specialStream = {
                ...mockStream,
                folder: 'Streams/Test (Special) #1'
            };

            streamDataService.getDefaultFilePath.mockReturnValue(null as any);

            const result = filePathProviderService.getDefaultFilePath(specialStream);

            expect(result).toBe('Streams/Test (Special) #1/default.md');
            expect(streamDataService.getDefaultFilePath).toHaveBeenCalledWith(specialStream);
        });
    });
});