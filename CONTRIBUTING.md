# Contributing to Streams

Welcome! We gladly accept contributions from the community. If you'd like to help improve Streams, follow the steps below.

## How to Contribute

1. **Fork the repository** and clone it to your local machine.
2. **Install dependencies** by running `npm install`.
3. **Create a new branch** for your feature or bug fix (`git checkout -b feature/your-feature-name`).
4. **Make your changes**. You can use `npm run dev` to watch for changes and compile the plugin, then test them locally in your Obsidian vault.
5. **Commit your changes** with clear, descriptive commit messages.
6. **Push to your fork** and open a Pull Request against our `main` branch.

All Pull Requests will be reviewed and merged by the maintainer.

---

## Maintainer Guide: Releasing a New Version
*(The following instructions are for project maintainers only)*

The release process is fully automated via GitHub Actions. **You do not need to build the plugin or generate attestations manually.**

Whenever a new tag is pushed, a background GitHub Action will automatically:
- **Build the plugin** (`main.js`, `styles.css`) from source.
- **Generate cryptographic artifact attestations** for security and provenance.
- **Publish a GitHub Release** and attach the built artifacts.

Before triggering a release, **you must bump the version numbers**:
1. Run `npm run version` (or manually update `manifest.json` and `versions.json`).
2. Commit and push the changes to the `main` branch.

Once the versions are bumped, you can trigger the automated release using either the GitHub UI or the command line.

### Option 1: Using the GitHub Releases UI (Recommended)
This is the simplest method if you prefer a visual interface.

1. Navigate to the **Releases** page on your GitHub repository.
2. Click the **Draft a new release** button.
3. In the "Choose a tag" dropdown, type your new version tag (e.g., `1.0.6`) and click **Create new tag: 1.0.6 on publish**.
4. (Optional) Fill out the release title and notes.
5. Click **Publish release**.

> **Note:** As soon as you click publish, GitHub will trigger the Action in the background. Navigate to the **Actions** tab to watch it build, sign, and attach the files to your newly drafted release!

### Option 2: Using the Command Line (CLI)
If you prefer terminal commands, you can push the tag directly via Git.

1. Create a local tag for your new version:
   ```bash
   git tag 1.0.6
   ```
2. Push the tag to GitHub:
   ```bash
   git push origin main --tags
   ```

> **Note:** Pushing the tag automatically triggers the GitHub Action. The Action will build the assets and create the GitHub Release for you automatically. You can edit the release notes in the GitHub UI afterward if needed.
