# Streams

*Create and manage multiple daily note streams*

- > Replaces the Daily Note core plugin.
- > Inspired by the Periodic Notes and Calendar plugins.

![assets/logo-transparent](assets/logo-transparent.png)

## Features
- Multiple daily note streams.
- Full calendar for each stream.
- New view for missing notes.
- New view for viewing all notes in a stream.
- "All Streams" dashboard view with statistics and quick actions.

## Getting started
- Add new stream in settings, "Daily Notes", pointing to where you store your daily notes. There will be a ribbon button and a command to get to Today's Daily Note. Enable Full Stream view to get a view into your stream history. Disable core Daily Note plugin.
- Then create another stream for work?
- Then create another stream for school?
- Then create another stream for... whatever.

## Configure Streams
![Configure Streams](assets/demo-configure-streams.jpg)

## Each Stream's Daily Note
![Each Stream's Daily Note](assets/demo-today.gif)

## View Full Stream
![View Full Stream](assets/demo-full-stream.gif)

## All Streams Dashboard
The new All Streams view provides a comprehensive overview of all your configured streams. Access it via:
- **Ribbon Button**: Click the dashboard icon in the left sidebar
- **Command Palette**: Use "Open All Streams View"

## Quick Actions
The plugin provides several ribbon buttons for quick access:
- **📊 Dashboard Icon**: Opens the All Streams dashboard view
- **📅 Calendar Icon**: Automatically opens today's note for the current stream context

This view displays each stream as a card showing:
- Total number of files
- Files created this year and month
- Last modified date
- Quick action buttons to open today's note or view the full stream

## Commands
The plugin provides several commands accessible via the Command Palette and ribbon buttons:

- **Open Current Stream Today**: Automatically detects which stream the current view belongs to and opens that stream's today note. This works whether you're in a file that belongs to a stream, a stream view, or a create file view. This is useful when you want to quickly jump to today's note for the current stream context.
  - **Command Palette**: "Open Current Stream Today"
  - **Ribbon Button**: 📅 Calendar icon in the left sidebar
- **Open All Streams View**: Opens the dashboard view showing all streams.
  - **Command Palette**: "Open All Streams View"
  - **Ribbon Button**: 📊 Dashboard icon in the left sidebar
- **Toggle calendar component**: Shows/hides the calendar component.

Individual stream commands are also available if enabled in stream settings:
- **Stream Name, today**: Opens today's note for a specific stream.
- **Open full view: Stream Name**: Opens the full stream view for a specific stream.

### Keyboard Shortcuts
You can assign custom keyboard shortcuts to any of these commands through Obsidian's Settings → Hotkeys. Some recommended shortcuts:
- **Open Current Stream Today**: `Ctrl+Shift+T` (or `Cmd+Shift+T` on Mac)
- **Open All Streams View**: `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)