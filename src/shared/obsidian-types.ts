import { App, Plugin } from 'obsidian';

/**
 * Type definitions for Obsidian's internal APIs
 * These interfaces extend Obsidian's public types to access internal properties
 * that are not part of the public API but are commonly needed
 */

/**
 * Interface for Obsidian's plugin manager
 */
export interface ObsidianPlugins {
    plugins?: {
        [pluginId: string]: Plugin | undefined;
    };
    enabledPlugins?: Set<string>;
    disablePlugin?: (pluginId: string) => Promise<void>;
    enablePlugin?: (pluginId: string) => Promise<void>;
}

/**
 * Interface for Obsidian's command registry
 */
export interface ObsidianCommands {
    commands?: {
        [commandId: string]: {
            id: string;
            name: string;
            callback?: () => void | Promise<void>;
            checkCallback?: (checking: boolean) => boolean | void;
        } | undefined;
    };
    executeCommandById?: (commandId: string) => Promise<void>;
    listCommands?: () => Array<{ id: string; name: string }>;
}

/**
 * Interface for Obsidian's settings manager
 */
export interface ObsidianSetting {
    open?: () => void;
    openTabById?: (tabId: string) => void;
    close?: () => void;
}

/**
 * Extended App interface with internal Obsidian properties
 * Use this when you need to access plugins, commands, or settings
 */
export interface ObsidianAppWithInternals extends App {
    plugins?: ObsidianPlugins;
    commands?: ObsidianCommands;
    setting?: ObsidianSetting;
}

/**
 * Type guard to check if an App instance has internal properties
 */
export function hasInternalProperties(app: App): app is ObsidianAppWithInternals {
    return 'plugins' in app || 'commands' in app || 'setting' in app;
}

/**
 * Safely access plugins from an App instance
 */
export function getPlugins(app: App): ObsidianPlugins['plugins'] | undefined {
    if (hasInternalProperties(app)) {
        return app.plugins?.plugins;
    }
    return undefined;
}

/**
 * Safely access commands from an App instance
 */
export function getCommands(app: App): ObsidianCommands['commands'] | undefined {
    if (hasInternalProperties(app)) {
        return app.commands?.commands;
    }
    return undefined;
}

/**
 * Safely access settings from an App instance
 */
export function getSetting(app: App): ObsidianSetting | undefined {
    if (hasInternalProperties(app)) {
        return app.setting;
    }
    return undefined;
}

/**
 * Safely execute a command by ID
 */
export async function executeCommandById(app: App, commandId: string): Promise<void> {
    if (hasInternalProperties(app) && app.commands?.executeCommandById) {
        await app.commands.executeCommandById(commandId);
    } else {
        throw new Error(`Cannot execute command ${commandId}: command execution not available`);
    }
}

/**
 * Get a specific plugin by ID
 */
export function getPluginById(app: App, pluginId: string): Plugin | undefined {
    const plugins = getPlugins(app);
    return plugins?.[pluginId];
}

/**
 * Get a specific command by ID
 */
export function getCommandById(app: App, commandId: string): ObsidianCommands['commands'][string] | undefined {
    const commands = getCommands(app);
    return commands?.[commandId];
}

