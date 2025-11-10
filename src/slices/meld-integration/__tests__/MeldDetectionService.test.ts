import { App } from 'obsidian';
import { MeldDetectionService } from '../MeldDetectionService';
import { Plugin } from 'obsidian';

describe('MeldDetectionService', () => {
  let service: MeldDetectionService;
  let mockPlugin: Partial<Plugin>;
  let mockApp: Partial<App>;

  beforeEach(() => {
    service = new MeldDetectionService();
    
    mockApp = {
      plugins: {
        plugins: {},
      },
      commands: {
        commands: {},
      },
    } as any;

    mockPlugin = {
      app: mockApp as App,
    } as Plugin;

    service.setPlugin(mockPlugin as Plugin);
  });

  describe('isMeldPluginAvailable', () => {
    it('should return false when plugins object does not exist', async () => {
      await service.initialize();
      const app = { } as App;
      (mockPlugin as any).app = app;
      expect(service.isMeldPluginAvailable()).toBe(false);
    });

    it('should return false when meld-encrypt plugin is not installed', async () => {
      await service.initialize();
      const app = {
        plugins: {
          plugins: {
            'other-plugin': {},
          },
        },
      } as any as App;
      (mockPlugin as any).app = app;
      expect(service.isMeldPluginAvailable()).toBe(false);
    });

    it('should return false when meld-encrypt plugin exists but commands do not', async () => {
      await service.initialize();
      const app = {
        plugins: {
          plugins: {
            'meld-encrypt': {},
          },
        },
        commands: undefined,
      } as any as App;
      (mockPlugin as any).app = app;
      expect(service.isMeldPluginAvailable()).toBe(false);
    });

    it('should return false when meld-encrypt plugin exists but command is missing', async () => {
      await service.initialize();
      const app = {
        plugins: {
          plugins: {
            'meld-encrypt': {},
          },
        },
        commands: {
          commands: {
            'other-command': {},
          },
        },
      } as any as App;
      (mockPlugin as any).app = app;
      expect(service.isMeldPluginAvailable()).toBe(false);
    });

    it('should return true when meld-encrypt plugin is installed and command exists', async () => {
      await service.initialize();
      const app = {
        plugins: {
          plugins: {
            'meld-encrypt': {},
          },
        },
        commands: {
          commands: {
            'meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note': {
              callback: jest.fn(),
            },
          },
        },
      } as any as App;
      (mockPlugin as any).app = app;
      expect(service.isMeldPluginAvailable()).toBe(true);
    });

    it('should return false when an error occurs during detection', async () => {
      await service.initialize();
      const app = {
        get plugins() {
          throw new Error('Test error');
        },
      } as any as App;
      (mockPlugin as any).app = app;
      expect(service.isMeldPluginAvailable()).toBe(false);
    });
  });

  describe('getMeldCommandId', () => {
    it('should return the correct Meld command ID', async () => {
      await service.initialize();
      expect(service.getMeldCommandId()).toBe('meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note');
    });
  });

  describe('getMeldUnavailableMessage', () => {
    it('should return a user-friendly error message', async () => {
      await service.initialize();
      const message = service.getMeldUnavailableMessage();
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('executeMeldEncryption', () => {
    it('should return false when Meld is not available', async () => {
      await service.initialize();
      const app = {
        plugins: {
          plugins: {},
        },
      } as any as App;
      (mockPlugin as any).app = app;

      const result = await service.executeMeldEncryption();
      expect(result).toBe(false);
    });

    it('should execute command when Meld is available', async () => {
      await service.initialize();
      const mockCallback = jest.fn().mockResolvedValue(undefined);
      const app = {
        plugins: {
          plugins: {
            'meld-encrypt': {},
          },
        },
        commands: {
          commands: {
            'meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note': {
              callback: mockCallback,
            },
          },
        },
      } as any as App;
      (mockPlugin as any).app = app;
      
      const result = await service.executeMeldEncryption();
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should return false when command is not found', async () => {
      await service.initialize();
      const app = {
        plugins: {
          plugins: {
            'meld-encrypt': {},
          },
        },
        commands: {
          commands: {},
        },
      } as any as App;
      (mockPlugin as any).app = app;
      
      const result = await service.executeMeldEncryption();
      expect(result).toBe(false);
    });
  });

  describe('initialize and cleanup', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      expect(service.isMeldPluginAvailable()).toBeDefined();
    });

    it('should cleanup successfully', async () => {
      await service.initialize();
      service.cleanup();
      // Cleanup should not throw
      expect(() => service.cleanup()).not.toThrow();
    });
  });
});





