# MD Image Embed

MDImageEmbed is an Obsidian plugin that converts local images in Markdown files to Base64 embedded format. Useful for exporting notes, publishing blogs, or sharing documents without external image dependencies.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7c3aed)](https://obsidian.md)

## Features

- **One-click conversion**: Right-click → Copy as Base64 format to clipboard
- **Smart path resolution**: Handles Obsidian's various image path formats
- **Anti-reprint protection**: Optional prefix/suffix for copyright notices
- **Format support**: PNG, JPG, JPEG, GIF, WebP, SVG, BMP
- **Wiki link support**: Converts `![[image.png]]` to standard Markdown with Base64

## Installation

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create folder `<Vault>/.obsidian/plugins/md-image-embed/`
3. Copy files to the folder
4. Restart Obsidian and enable the plugin in Settings → Community Plugins

### Build from Source

```bash
git clone https://github.com/MZSH-Tools/MDImageEmbed.git
cd MDImageEmbed
npm install
npm run build
```

## Usage

1. Right-click any `.md` file in Obsidian's file explorer
2. Select **Copy as Base64 format**
3. Paste the converted content anywhere you need

### Settings

Configure in **Settings → Community Plugins → MD Image Embed**:

- **Show conversion log**: Display detailed conversion summary
- **Show detailed log**: Show individual image status in notifications
- **Convert Wiki links**: Convert `![[image.png]]` to standard Markdown
- **Skip Base64 images**: Skip already converted Base64 images
- **Prefix/Suffix file path**: Add custom content before/after the article (for anti-reprint protection)

### Anti-reprint Protection

To add copyright notices or author info:

1. Create template files (e.g., `templates/prefix.md`, `templates/suffix.md`)
2. Enter file paths in plugin settings
3. Content will be automatically added when copying

## Notes

- Only local images are supported (network URLs are skipped)
- Base64 encoding increases file size by ~33%
- Recommended for export/sharing scenarios only

## License

MIT License

## Contact

Email: mengzhishanghun@outlook.com
