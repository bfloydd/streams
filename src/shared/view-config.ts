import { InstallMeldView, INSTALL_MELD_VIEW_TYPE } from '../slices/file-operations/InstallMeldView';
import { CreateFileViewEncrypted, CREATE_FILE_VIEW_ENCRYPTED_TYPE } from '../slices/file-operations/CreateFileViewEncrypted';

/**
 * View configuration for metadata-driven registration
 */
export interface ViewConfig {
    viewType: string;
    ViewClass: new (leaf: any, app: any, ...args: any[]) => any;
    defaultSettings: any;
    extraArgs?: any[];
}

/**
 * View configurations
 */
export const VIEW_CONFIGS: ViewConfig[] = [
    {
        viewType: INSTALL_MELD_VIEW_TYPE,
        ViewClass: InstallMeldView,
        defaultSettings: {
            id: '',
            name: '',
            folder: '',
            icon: 'book',
            showTodayInRibbon: false,
            addCommand: false,
            encryptThisStream: false,
            disabled: false
        },
        extraArgs: [new Date()]
    },
    {
        viewType: CREATE_FILE_VIEW_ENCRYPTED_TYPE,
        ViewClass: CreateFileViewEncrypted,
        defaultSettings: {
            id: '',
            name: '',
            folder: '',
            icon: 'book',
            showTodayInRibbon: false,
            addCommand: false,
            encryptThisStream: true,
            disabled: false
        }
    }
];

/**
 * Get all view configurations
 */
export function getAllViewConfigs(): ViewConfig[] {
    return [...VIEW_CONFIGS];
}
