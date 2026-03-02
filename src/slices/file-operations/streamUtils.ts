import { App, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/CentralizedLogger';
import { CREATE_FILE_VIEW_TYPE } from './CreateFileView';
import { INSTALL_MELD_VIEW_TYPE } from './InstallMeldView';
import { CREATE_FILE_VIEW_ENCRYPTED_TYPE } from './CreateFileViewEncrypted';
import { DateStateManager } from '../../shared/DateStateManager';
import { MeldDetectionService } from '../meld-integration';
import { LeafSelectionService } from './LeafSelectionService';

/**
 * Check if Meld plugin is available using MeldDetectionService
 * Uses static helper method for utility functions that don't have plugin context
 */
function isMeldPluginAvailable(app: App): boolean {
    return MeldDetectionService.checkMeldAvailability(app);
}

/**
 * Show the InstallMeldView when Meld is not available
 */
async function showInstallMeldView(app: App, file: TFile, stream: Stream, date: Date, reuseCurrentTab: boolean): Promise<void> {
    try {
        // Use LeafSelectionService to select appropriate leaf
        const leaf = LeafSelectionService.selectLeaf(
            app,
            reuseCurrentTab,
            (viewType) => !viewType.includes('markdown')
        );

        // Check if leaf is null before proceeding
        if (!leaf) {
            centralizedLogger.error('Failed to create or find a workspace leaf for InstallMeldView');
            return;
        }

        try {
            // Check if leaf is still valid
            if (!leaf || !leaf.view) {
                centralizedLogger.error(`Leaf is no longer valid, cannot set view state`);
                return;
            }

            // Update the date state manager to reflect the current date
            const dateStateManager = DateStateManager.getInstance();
            dateStateManager.setCurrentDate(date);

            // Use the proper Obsidian view system instead of direct DOM manipulation
            try {
                await leaf.setViewState({
                    type: INSTALL_MELD_VIEW_TYPE,
                    state: {
                        stream: stream,
                        date: date.toISOString(),
                        filePath: file.path
                    }
                });
            } catch (error) {
                centralizedLogger.error(`Error setting view state for InstallMeldView:`, error);
                // If setViewState fails, we can't proceed
                return;
            }

            // Set the active leaf
            app.workspace.setActiveLeaf(leaf, { focus: true });

        } catch (error) {
            centralizedLogger.error('Error setting up InstallMeldView:', error);
            return;
        }
    } catch (error) {
        centralizedLogger.error('Error showing encrypted file view:', error);
    }
}

/**
 * Interface for Obsidian's internal ViewRegistry, which manages all view registrations
 */
interface ViewRegistry {
    /**
     * Register a view creator function for a given view type
     */
    registerView(viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any): void;

    /**
     * Get a view creator function for a given view type
     */
    getViewCreatorByType(viewType: string): ((leaf: WorkspaceLeaf) => any) | null;
}

/**
 * Interface for Obsidian's App with internal ViewRegistry
 */
interface AppWithViewRegistry extends App {
    viewRegistry: ViewRegistry;
}




/**
 * Recursively creates a folder path if it doesn't exist.
 */
export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
    if (!folderPath) return;

    const parts = folderPath.split(/[/\\]/).filter(Boolean);
    let currentPath = '';

    for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const folderExists = app.vault.getAbstractFileByPath(currentPath);
        if (!folderExists) {
            try {
                await app.vault.createFolder(currentPath);
            } catch (error) {
                // Folder might have been created concurrently
                centralizedLogger.debug(`Folder might already exist ${currentPath}`, error);
            }
        }
    }
}

/**
 * Formats a date as YYYY-MM-DD for filenames
 */
export function formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getFolderSuggestions(app: App): string[] {
    const folders: string[] = [];

    function recurseFolder(folder: TFolder, path = '') {
        const folderPath = path ? `${path}/${folder.name}` : folder.name;
        folders.push(folderPath);

        folder.children.forEach(child => {
            if (child instanceof TFolder) {
                recurseFolder(child, folderPath);
            }
        });
    }

    app.vault.getAllLoadedFiles().forEach(file => {
        if (file instanceof TFolder) {
            recurseFolder(file);
        }
    });

    return folders;
}

export async function createDailyNote(app: App, folder: string): Promise<TFile | null> {
    const date = new Date();
    // Use the flexible resolver but for a generic/default stream context
    const fakeStream: Stream = {
        id: 'tmp', name: 'tmp', icon: 'book', showTodayInRibbon: false, addCommand: false,
        encryptThisStream: false, disabled: false,
        dateFormat: `${folder}/YYYY-MM-DD`
    };

    const filePath = resolveStreamFilePath(fakeStream, date);

    let file = app.vault.getAbstractFileByPath(filePath);

    if (!file) {
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        await ensureFolderExists(app, folderPath);

        const template = '';
        file = await app.vault.create(filePath, template);
    }

    return file instanceof TFile ? file : null;
}

/**
 * Resolves a dynamic file path for a stream using the provided date.
 * Supports `{TOKEN}` bracket syntax for mixing literal text and moment.js formats.
 * Maintains backwards compatibility for `dateFormat` strings without brackets.
 */
export function resolveStreamFilePath(stream: Stream, date: Date | string, extension: string = 'md'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const momentDate = (window as any).moment(d);

    // Process File path template (File Name + Path)
    let fullPath = stream.dateFormat || 'YYYY-MM-DD';

    if (fullPath.includes('{')) {
        // Evaluate {TOKENS}
        fullPath = fullPath.replace(/\{([^}]+)\}/g, (_, token) => momentDate.format(token));
    } else {
        // Legacy mode: entire string is a format
        fullPath = momentDate.format(fullPath);
    }

    if (!fullPath.endsWith(`.${extension}`)) {
        fullPath += `.${extension}`;
    }

    // Normalize path for Obsidian API compatibility (remove leading slash if present)
    if (fullPath.startsWith('/')) {
        fullPath = fullPath.slice(1);
    }

    return fullPath;
}

/**
 * Extracts the static top-level directory from a stream's file path template.
 * Used to identify if an arbitrary file belongs to a stream.
 */
export function getStreamBaseFolder(stream: Stream): string {
    const format = stream.dateFormat || '';

    const braceIndex = format.indexOf('{');
    let prefix = format;

    if (braceIndex !== -1) {
        prefix = format.substring(0, braceIndex);
    }

    // Find the last slash in the remaining literal prefix
    const lastSlash = prefix.lastIndexOf('/');
    if (lastSlash !== -1) {
        return prefix.substring(0, lastSlash);
    }

    return '';
}

export async function openStreamDate(app: App, stream: Stream, date: Date = new Date(), reuseCurrentTab = false, targetLeaf?: WorkspaceLeaf, dateStateManager?: DateStateManager): Promise<void> {
    // Opening stream date

    if (!(date instanceof Date) || isNaN(date.getTime())) {
        centralizedLogger.error(`Invalid date provided: ${date}`);
        return;
    }

    // Always recalculate filePath from the stream object, which should be fresh
    const filePath = resolveStreamFilePath(stream, date);
    const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));

    // Looking for file at path

    let file = app.vault.getAbstractFileByPath(filePath);

    // If file not found, check for encrypted version (.mdenc)
    if (!file) {
        const encryptedFilePath = filePath.replace(/\.md$/, '.mdenc');
        file = app.vault.getAbstractFileByPath(encryptedFilePath);
    }

    if (!file) {
        // File not found, showing create file view
        await ensureFolderExists(app, folderPath);

        // Use targetLeaf if provided, otherwise select appropriate leaf
        const leaf = targetLeaf || LeafSelectionService.selectLeaf(
            app,
            reuseCurrentTab,
            (viewType) => !viewType.includes('markdown')
        );

        // Check if leaf is null before proceeding
        if (!leaf) {
            centralizedLogger.error('Failed to create or find a workspace leaf for CreateFileView');
            return;
        }

        try {
            // Check if leaf is still valid
            if (!leaf || !leaf.view) {
                centralizedLogger.error(`Leaf is no longer valid, cannot set view state`);
                return;
            }

            // Update the date state manager to reflect the current date
            const dsm = dateStateManager || DateStateManager.getInstance();
            dsm.setCurrentDate(date);

            // Use the proper Obsidian view system instead of direct DOM manipulation
            // Check if Meld is available and stream encryption status to determine view
            let viewType: string;
            if (!isMeldPluginAvailable(app)) {
                // Meld not available: show InstallMeldView only if stream has encryption enabled
                // Otherwise show CreateFileView (normal behavior)
                viewType = stream.encryptThisStream ? INSTALL_MELD_VIEW_TYPE : CREATE_FILE_VIEW_TYPE;
            } else {
                // Meld available: choose based on stream encryption setting
                viewType = stream.encryptThisStream ? CREATE_FILE_VIEW_ENCRYPTED_TYPE : CREATE_FILE_VIEW_TYPE;
            }

            try {
                await leaf.setViewState({
                    type: viewType,
                    state: {
                        stream: stream,
                        date: date.toISOString(),
                        filePath: filePath
                    }
                });
            } catch (error) {
                centralizedLogger.error(`Error setting view state for ${viewType}:`, error);
                // If setViewState fails, we can't proceed
                return;
            }

            // Set the active leaf
            app.workspace.setActiveLeaf(leaf, { focus: true });

        } catch (error) {
            centralizedLogger.error('Error setting up CreateFileView:', error);
            return;
        }

        return;
    }

    if (file instanceof TFile) {
        try {
            // Check if this is a .mdenc file
            const isMdencFile = file.path.endsWith('.mdenc');

            if (isMdencFile) {
                // For .mdenc files, check if Meld is available first
                if (!isMeldPluginAvailable(app)) {
                    // Show the InstallMeldView instead of just an error
                    await showInstallMeldView(app, file, stream, date, reuseCurrentTab);
                    return;
                }

                // For .mdenc files, just open them normally and let Meld handle the encryption

                // Update the date state manager to reflect the current date
                const dsm = dateStateManager || DateStateManager.getInstance();
                dsm.setCurrentDate(date);

                // Use targetLeaf if provided, otherwise select appropriate leaf
                const leaf = targetLeaf || LeafSelectionService.selectLeaf(app, reuseCurrentTab);

                if (leaf) {
                    await leaf.openFile(file);
                    app.workspace.setActiveLeaf(leaf, { focus: true });
                }
                return;
            }

            // For .md files, just open them normally

            // Update the date state manager to reflect the current date
            const dsm = dateStateManager || DateStateManager.getInstance();
            dsm.setCurrentDate(date);

            // Use targetLeaf if provided, otherwise find existing leaf or create new one
            const leaf = targetLeaf || LeafSelectionService.selectLeafForFile(app, file, reuseCurrentTab);

            if (leaf) {
                await leaf.openFile(file);
                app.workspace.setActiveLeaf(leaf, { focus: true });
            }
        } catch (e) {
            centralizedLogger.error('Error opening stream date:', e);
        }
    }
} 
