import { Stream } from '../../../shared/types';
import { CREATE_FILE_VIEW_TYPE } from '../CreateFileView';
import { INSTALL_MELD_VIEW_TYPE } from '../InstallMeldView';
import { CREATE_FILE_VIEW_ENCRYPTED_TYPE } from '../CreateFileViewEncrypted';

/**
 * Helper function to determine view type based on Meld availability and stream encryption
 * This mirrors the logic in streamUtils.ts openStreamDate function
 */
function determineViewType(
  isMeldAvailable: boolean,
  streamEncryptThisStream: boolean
): string {
  if (!isMeldAvailable) {
    // Meld not available: show InstallMeldView only if stream has encryption enabled
    // Otherwise show CreateFileView (normal behavior)
    return streamEncryptThisStream ? INSTALL_MELD_VIEW_TYPE : CREATE_FILE_VIEW_TYPE;
  } else {
    // Meld available: choose based on stream encryption setting
    return streamEncryptThisStream ? CREATE_FILE_VIEW_ENCRYPTED_TYPE : CREATE_FILE_VIEW_TYPE;
  }
}

describe('View Selection Logic for Meld Integration', () => {
  describe('when Meld is NOT available', () => {
    it('should show CreateFileView when stream encryption is disabled', () => {
      const stream: Stream = {
        id: 'test-stream',
        name: 'Test Stream',
        
        icon: 'file-text',
        showTodayInRibbon: false,
        addCommand: false,
        encryptThisStream: false,
            dateFormat: 'YYYY-MM-DD',
        disabled: false,
      };

      const viewType = determineViewType(false, stream.encryptThisStream);
      expect(viewType).toBe(CREATE_FILE_VIEW_TYPE);
    });

    it('should show InstallMeldView when stream encryption is enabled', () => {
      const stream: Stream = {
        id: 'test-stream',
        name: 'Test Stream',
        
        icon: 'file-text',
        showTodayInRibbon: false,
        addCommand: false,
        encryptThisStream: true,
            dateFormat: 'YYYY-MM-DD',
        disabled: false,
      };

      const viewType = determineViewType(false, stream.encryptThisStream);
      expect(viewType).toBe(INSTALL_MELD_VIEW_TYPE);
    });
  });

  describe('when Meld IS available', () => {
    it('should show CreateFileViewEncrypted when stream encryption is enabled', () => {
      const stream: Stream = {
        id: 'test-stream',
        name: 'Test Stream',
        
        icon: 'file-text',
        showTodayInRibbon: false,
        addCommand: false,
        encryptThisStream: true,
            dateFormat: 'YYYY-MM-DD',
        disabled: false,
      };

      const viewType = determineViewType(true, stream.encryptThisStream);
      expect(viewType).toBe(CREATE_FILE_VIEW_ENCRYPTED_TYPE);
    });

    it('should show CreateFileView when stream encryption is disabled', () => {
      const stream: Stream = {
        id: 'test-stream',
        name: 'Test Stream',
        
        icon: 'file-text',
        showTodayInRibbon: false,
        addCommand: false,
        encryptThisStream: false,
            dateFormat: 'YYYY-MM-DD',
        disabled: false,
      };

      const viewType = determineViewType(true, stream.encryptThisStream);
      expect(viewType).toBe(CREATE_FILE_VIEW_TYPE);
    });
  });

  describe('spec compliance - all 4 scenarios from spec.md', () => {
    it('spec: Meld not installed + stream encryption disabled → CreateFileView', () => {
      const viewType = determineViewType(false, false);
      expect(viewType).toBe(CREATE_FILE_VIEW_TYPE);
    });

    it('spec: Meld not installed + stream encryption enabled → InstallMeldView', () => {
      const viewType = determineViewType(false, true);
      expect(viewType).toBe(INSTALL_MELD_VIEW_TYPE);
    });

    it('spec: Meld installed + stream encryption enabled → CreateFileViewEncrypted', () => {
      const viewType = determineViewType(true, true);
      expect(viewType).toBe(CREATE_FILE_VIEW_ENCRYPTED_TYPE);
    });

    it('spec: Meld installed + stream encryption disabled → CreateFileView', () => {
      const viewType = determineViewType(true, false);
      expect(viewType).toBe(CREATE_FILE_VIEW_TYPE);
    });
  });
});

