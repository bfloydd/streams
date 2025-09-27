# Streams Plugin Public API

The Streams plugin provides a public API that other Obsidian plugins can use to access stream data and functionality.

## Accessing the API

To access the Streams plugin API from another plugin:

```typescript
// Get the Streams plugin instance
const streamsPlugin = this.app.plugins.getPlugin('streams') as StreamsPlugin;

if (streamsPlugin) {
    // Access the public API
    const streams = streamsPlugin.getStreams();
    const activeStream = streamsPlugin.getActiveStream();
    // ... use other API methods
}
```

## Available Methods

### `getStreams(): Stream[]`
Returns all configured streams.

```typescript
const allStreams = streamsPlugin.getStreams();
console.log(`Found ${allStreams.length} streams`);
```

### `getStream(streamId: string): Stream | null`
Get a specific stream by its ID.

```typescript
const stream = streamsPlugin.getStream('stream-id-here');
if (stream) {
    console.log(`Found stream: ${stream.name}`);
}
```

### `getActiveStream(): Stream | null`
Get the currently active stream.

```typescript
const activeStream = streamsPlugin.getActiveStream();
if (activeStream) {
    console.log(`Active stream: ${activeStream.name}`);
}
```

### `getStreamsByFolder(folderPath: string): Stream[]`
Get all streams that match a specific folder path.

```typescript
const streams = streamsPlugin.getStreamsByFolder('Assets/Streams');
console.log(`Found ${streams.length} streams in Assets/Streams`);
```

### `getStreamForFile(filePath: string): Stream | null`
Get the stream that contains a specific file.

```typescript
const stream = streamsPlugin.getStreamForFile('Assets/Streams/Per/2024-01-15.md');
if (stream) {
    console.log(`File belongs to stream: ${stream.name}`);
}
```

### `getStreamInfo(): StreamInfo[]`
Get basic stream information for external use.

```typescript
const streamInfo = streamsPlugin.getStreamInfo();
streamInfo.forEach(info => {
    console.log(`${info.name} (${info.folder}) - Active: ${info.isActive}`);
});
```

### `hasStream(streamId: string): boolean`
Check if a stream exists.

```typescript
if (streamsPlugin.hasStream('stream-id')) {
    console.log('Stream exists');
}
```

### `getStreamCount(): number`
Get the total number of configured streams.

```typescript
const count = streamsPlugin.getStreamCount();
console.log(`Total streams: ${count}`);
```

### `getVersion(): PluginVersion`
Get plugin version information.

```typescript
const version = streamsPlugin.getVersion();
console.log(`Streams plugin version: ${version.version}`);
```

## Data Types

### Stream
```typescript
interface Stream {
    id: string;
    name: string;
    folder: string;
    icon: LucideIcon;
    showTodayInRibbon: boolean;
    addCommand: boolean;
}
```

### StreamInfo
```typescript
interface StreamInfo {
    id: string;
    name: string;
    folder: string;
    icon: string;
    isActive: boolean;
}
```

### PluginVersion
```typescript
interface PluginVersion {
    version: string;
    minAppVersion: string;
    name: string;
    id: string;
}
```

## Example Usage

Here's a complete example of how another plugin might use the Streams API:

```typescript
export default class MyPlugin extends Plugin {
    async onload() {
        // Wait for Streams plugin to load
        this.app.workspace.onLayoutReady(() => {
            const streamsPlugin = this.app.plugins.getPlugin('streams') as StreamsPlugin;
            
            if (streamsPlugin) {
                // Get all streams
                const streams = streamsPlugin.getStreams();
                console.log(`Streams plugin loaded with ${streams.length} streams`);
                
                // Get active stream
                const activeStream = streamsPlugin.getActiveStream();
                if (activeStream) {
                    console.log(`Active stream: ${activeStream.name}`);
                }
                
                // Check if current file belongs to a stream
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    const stream = streamsPlugin.getStreamForFile(activeFile.path);
                    if (stream) {
                        console.log(`Current file belongs to stream: ${stream.name}`);
                    }
                }
            }
        });
    }
}
```

## Notes

- The API is read-only for security reasons
- All methods return copies of data to prevent external modification
- The plugin must be enabled for the API to be available
- Stream IDs are UUIDs and should be treated as opaque strings
