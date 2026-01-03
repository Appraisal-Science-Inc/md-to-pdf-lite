# md-to-pdf-lite

Convert Markdown to PDF using your system's Chrome browser. No 250MB Puppeteer/Playwright browser downloads.

## Installation

```bash
npm install -g md-to-pdf-lite
```

## Requirements

- Node.js 18+
- Chrome, Chromium, or Microsoft Edge installed on your system

## Usage

```bash
md-to-pdf-lite README.md                    # Creates README.pdf
md-to-pdf-lite input.md output.pdf          # Custom output path
md-to-pdf-lite docs/guide.md                # Works with paths
```

## Features

- **GitHub Flavored Markdown** - tables, task lists, fenced code blocks
- **Proper image handling** - relative image paths are resolved correctly
- **Clean styling** - GitHub-inspired CSS
- **Lightweight** - only `marked` as a dependency, uses your existing browser

## Why?

Other Markdown-to-PDF tools bundle Chromium (~250MB download). This tool uses the Chrome/Chromium/Edge you already have installed.

## Supported Browsers

Automatically detected in this order:

- Google Chrome
- Chromium
- Microsoft Edge

### macOS paths
- `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- `/Applications/Chromium.app/Contents/MacOS/Chromium`
- `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`

### Linux paths
- `/usr/bin/google-chrome`
- `/usr/bin/google-chrome-stable`
- `/usr/bin/chromium`
- `/usr/bin/chromium-browser`

## Programmatic Usage

```javascript
import { convertMarkdownToPdf } from 'md-to-pdf-lite';

await convertMarkdownToPdf('input.md', 'output.pdf');
```

## License

MIT
