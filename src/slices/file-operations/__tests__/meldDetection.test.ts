import { App } from 'obsidian';

/**
 * Helper function to check if Meld plugin is available
 * This mirrors the logic in streamUtils.ts
 */
function isMeldPluginAvailable(app: App): boolean {
  try {
    // Check if the Meld plugin is installed and enabled
    const plugins = (app as any).plugins?.plugins;
    if (!plugins) return false;
    
    // Check for Meld plugin
    const meldPlugin = plugins['meld-encrypt'];
    if (!meldPlugin) return false;
    
    // Check if the specific command exists
    const commands = (app as any).commands?.commands;
    if (!commands) return false;
    
    return !!commands['meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note'];
  } catch (error) {
    return false;
  }
}

describe('Meld Plugin Detection', () => {
  let mockApp: Partial<App>;

  beforeEach(() => {
    mockApp = {
      plugins: {
        plugins: {},
      },
      commands: {
        commands: {},
      },
    } as any;
  });

  describe('isMeldPluginAvailable', () => {
    it('should return false when plugins object does not exist', () => {
      const app = {} as App;
      expect(isMeldPluginAvailable(app)).toBe(false);
    });

    it('should return false when meld-encrypt plugin is not installed', () => {
      const app = {
        plugins: {
          plugins: {
            'other-plugin': {},
          },
        },
      } as any as App;
      expect(isMeldPluginAvailable(app)).toBe(false);
    });

    it('should return false when meld-encrypt plugin exists but commands do not', () => {
      const app = {
        plugins: {
          plugins: {
            'meld-encrypt': {},
          },
        },
        commands: undefined,
      } as any as App;
      expect(isMeldPluginAvailable(app)).toBe(false);
    });

    it('should return false when meld-encrypt plugin exists but command is missing', () => {
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
      expect(isMeldPluginAvailable(app)).toBe(false);
    });

    it('should return true when meld-encrypt plugin is installed and command exists', () => {
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
      expect(isMeldPluginAvailable(app)).toBe(true);
    });

    it('should return false when an error occurs during detection', () => {
      const app = {
        get plugins() {
          throw new Error('Test error');
        },
      } as any as App;
      expect(isMeldPluginAvailable(app)).toBe(false);
    });
  });
});





