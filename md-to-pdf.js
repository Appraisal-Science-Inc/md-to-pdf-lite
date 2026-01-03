#!/usr/bin/env node

/**
 * md-to-pdf - Convert Markdown to PDF with proper image handling
 *
 * Uses system Chrome (no Playwright/Puppeteer browser downloads needed)
 *
 * Usage: md-to-pdf <input.md> [output.pdf]
 */

import { readFile, writeFile, unlink, mkdtemp } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { marked } from 'marked';

/**
 * Find Chrome executable on the system
 */
function findChrome() {
  const candidates = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    // WSL / Windows (via wslpath would need different handling)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Convert markdown string to HTML with GFM support
 */
export async function markdownToHtml(markdown, options = {}) {
  const { basePath = process.cwd() } = options;

  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  let html = await marked.parse(markdown);
  html = resolveImagePaths(html, basePath);

  return html;
}

/**
 * Resolve relative image paths in HTML to absolute file paths
 */
function resolveImagePaths(html, basePath) {
  const imgRegex = /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi;

  return html.replace(imgRegex, (fullMatch, before, src, after) => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return fullMatch;
    }

    const decodedSrc = decodeURIComponent(src);
    const absolutePath = resolve(basePath, decodedSrc);

    if (existsSync(absolutePath)) {
      return `<img ${before}src="file://${absolutePath}"${after}>`;
    }

    return fullMatch;
  });
}

/**
 * Generate full HTML document with styling
 */
export function wrapHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #24292e;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-top: 0; margin-bottom: 16px; }
    code {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 85%;
      background-color: rgba(27, 31, 35, 0.05);
      padding: 0.2em 0.4em;
      border-radius: 3px;
    }
    pre {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 85%;
      background-color: #f6f8fa;
      padding: 16px;
      overflow: auto;
      border-radius: 6px;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    blockquote {
      margin: 0;
      padding: 0 1em;
      color: #6a737d;
      border-left: 0.25em solid #dfe2e5;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    th, td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }
    th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
    tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    ul, ol {
      padding-left: 2em;
      margin-top: 0;
      margin-bottom: 16px;
    }
    li + li {
      margin-top: 0.25em;
    }
    input[type="checkbox"] {
      margin-right: 0.5em;
    }
    hr {
      border: 0;
      border-top: 1px solid #eaecef;
      margin: 24px 0;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Run Chrome in headless mode to generate PDF
 */
function runChrome(chromePath, htmlPath, pdfPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
      `--print-to-pdf=${pdfPath}`,
      '--no-pdf-header-footer',
      `file://${htmlPath}`,
    ];

    const proc = spawn(chromePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      // Chrome returns 0 on success, but may output warnings to stderr
      if (code === 0 && existsSync(pdfPath)) {
        resolve();
      } else {
        reject(new Error(`Chrome exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run Chrome: ${err.message}`));
    });
  });
}

/**
 * Convert a markdown file to PDF
 */
export async function convertMarkdownToPdf(inputPath, outputPath) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      'Chrome not found. Install Google Chrome, Chromium, or Microsoft Edge.'
    );
  }

  const absoluteInputPath = resolve(inputPath);
  const basePath = dirname(absoluteInputPath);

  const markdown = await readFile(absoluteInputPath, 'utf-8');
  const bodyHtml = await markdownToHtml(markdown, { basePath });
  const fullHtml = wrapHtml(bodyHtml);

  const tempDir = await mkdtemp(join(tmpdir(), 'md-to-pdf-'));
  const tempHtmlPath = join(tempDir, 'input.html');

  try {
    await writeFile(tempHtmlPath, fullHtml);
    await runChrome(chromePath, tempHtmlPath, resolve(outputPath));
  } finally {
    try {
      await unlink(tempHtmlPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// CLI handling
const __filename = fileURLToPath(import.meta.url);
const realArgv1 = await import('fs').then(fs =>
  fs.promises.realpath(process.argv[1]).catch(() => process.argv[1])
);
const isMain = realArgv1 === __filename || process.argv[1]?.endsWith('md-to-pdf-lite');

if (isMain) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
md-to-pdf-lite - Convert Markdown to PDF using system Chrome

Usage:
  md-to-pdf-lite <input.md> [output.pdf]

Examples:
  md-to-pdf-lite README.md
  md-to-pdf-lite docs/guide.md guide.pdf

Requires: Chrome, Chromium, or Microsoft Edge installed

If output path is not specified, uses the input filename with .pdf extension.
`);
    process.exit(0);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.md$/i, '.pdf');

  if (!existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`Converting ${inputPath} to ${outputPath}...`);

  convertMarkdownToPdf(inputPath, outputPath)
    .then(() => {
      console.log(`Done! Created ${outputPath}`);
    })
    .catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
}
