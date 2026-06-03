---
name: managing-obsidian-plugin
description: Manages the development, refactoring, and maintenance of an Obsidian plugin coding project. Use when the user requests feature additions, bug fixes, UI improvements, or refactoring in the Obsidian plugin codebase.
---

# Managing Obsidian Plugin

## When to use this skill
- Adding new features or settings to the Obsidian plugin.
- Refactoring existing plugin components (e.g., UI, logic).
- Fixing bugs or testing plugin functionality.
- Managing Obsidian API interactions.

## Workflow

### 1. Plan & Analyze
- [ ] Read relevant workspace files to locate the affected components (e.g., `main.ts`, view files, or service classes).
- [ ] Check `manifest.json` for required plugin version bumps if deploying a new release.
- [ ] Identify dependencies between UI components, styles, and core logic.

### 2. Validate
- [ ] Validate changes against existing test suites using relevant testing scripts.
- [ ] Check if the changes necessitate an update to settings menus or serialized data structures.

### 3. Execute
- [ ] Apply code changes using progressive and isolated module updates.
- [ ] Run `npm run build` to verify compilation without errors.

## Instructions
- Keep interactions with the Obsidian API well-isolated and properly typed.
- Prioritize updating or creating unit tests alongside feature development to verify logic safely.
- If a build script fails, do not proceed blindly; troubleshoot the specific error output before continuing.

## Architecture
- We use a vertical slice architecture.
- Strict adherance to cleancode rules.
- Use the provided .agent/skills/obsidian-plugin/SKILL.md as the main source of truth for coding standards and best practices.
- Use ADRs to document design decisions in adr/. Refer to the ADRs folder for more information and ensure compliance with existing ADRs.

## Resources
- None
