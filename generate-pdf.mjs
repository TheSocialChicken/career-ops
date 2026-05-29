#!/usr/bin/env node

/**
 * generate-pdf.mjs — HTML → PDF via Playwright
 *
 * Usage:
 *   node career-ops/generate-pdf.mjs <input.html> <output.pdf> [--format=letter|a4]
 *
 * Requires: @playwright/test (or playwright) installed.
 * Uses Chromium headless to render the HTML and produce a clean, ATS-parseable PDF.
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { readFile } from 'fs/promises';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure output directory exists (fresh setup)
mkdirSync(resolve(__dirname, 'output'), { recursive: true });

/**
 * Normalize text for ATS compatibility by converting problematic Unicode.
 *
 * ATS parsers and legacy systems often fail on em-dashes, smart quotes,
 * zero-width characters, and non-breaking spaces. These cause mojibake,
 * parsing errors, or display issues. See issue #1.
 *
 * Only touches body text — preserves CSS, JS, tag attributes, and URLs.
 * Returns { html, replacements } so the caller can log what was changed.
 */
function normalizeTextForATS(html) {
  const replacements = {};
  const bump = (key, n) => { replacements[key] = (replacements[key] || 0) + n; };

  const masks = [];
  const masked = html.replace(
    /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (match) => {
      const token = `\u0000MASK${masks.length}\u0000`;
      masks.push(match);
      return token;
    }
  );

  let out = '';
  let i = 0;
  while (i < masked.length) {
    const lt = masked.indexOf('<', i);
    if (lt === -1) { out += sanitizeText(masked.slice(i)); break; }
    out += sanitizeText(masked.slice(i, lt));
    const gt = masked.indexOf('>', lt);
    if (gt === -1) { out += masked.slice(lt); break; }
    out += masked.slice(lt, gt + 1);
    i = gt + 1;
  }

  const restored = out.replace(/\u0000MASK(\d+)\u0000/g, (_, n) => masks[Number(n)]);
  return { html: restored, replacements };

  function sanitizeText(text) {
    if (!text) return text;
    let t = text;
    t = t.replace(/\u2014/g, () => { bump('em-dash', 1); return '-'; });
    t = t.replace(/\u2013/g, () => { bump('en-dash', 1); return '-'; });
    t = t.replace(/[\u201C\u201D\u201E\u201F]/g, () => { bump('smart-double-quote', 1); return '"'; });
    t = t.replace(/[\u2018\u2019\u201A\u201B]/g, () => { bump('smart-single-quote', 1); return "'"; });
    t = t.replace(/\u2026/g, () => { bump('ellipsis', 1); return '...'; });
    t = t.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, () => { bump('zero-width', 1); return ''; });
    t = t.replace(/\u00A0/g, () => { bump('nbsp', 1); return ' '; });
    return t;
  }
}

// ─── Markdown → HTML (for report.pdf generation) ─────────────────────────────

function mdBodyToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) { i++; continue; }

    const hm = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hm) {
      out.push(`<h${hm[1].length}>${inlineMd(hm[2])}</h${hm[1].length}>`);
      i++; continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      out.push('<hr>');
      i++; continue;
    }

    if (trimmed.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim());
        i++;
      }
      out.push(tableToHtml(rows));
      continue;
    }

    if (/^[-*+]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i].trim())) {
        items.push(`<li>${inlineMd(lines[i].trim().replace(/^[-*+]\s/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+[.)]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(`<li>${inlineMd(lines[i].trim().replace(/^\d+[.)]\s/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        items.push(inlineMd(lines[i].trim().slice(2)));
        i++;
      }
      out.push(`<blockquote><p>${items.join('</p><p>')}</p></blockquote>`);
      continue;
    }

    const para = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l) break;
      if (l.startsWith('#') || l.startsWith('|') || /^[-*+]\s/.test(l) || /^\d+[.)]\s/.test(l) || /^[-*_]{3,}$/.test(l) || l.startsWith('> ')) break;
      para.push(inlineMd(lines[i]));
      i++;
    }
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`);
  }

  return out.join('\n');
}

function inlineMd(text) {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

function tableToHtml(rows) {
  const isSep = r => r.split('|').slice(1, -1).every(c => /^[\s\-:]+$/.test(c));
  const dataRows = rows.filter(r => !isSep(r));
  if (!dataRows.length) return '';
  let html = '<table>';
  dataRows.forEach((row, idx) => {
    const cells = row.split('|').slice(1, -1).map(c => c.trim());
    const tag = idx === 0 ? 'th' : 'td';
    html += '<tr>' + cells.map(c => `<${tag}>${inlineMd(c)}</${tag}>`).join('') + '</tr>';
  });
  html += '</table>';
  return html;
}

function markdownToHtmlDocument(md) {
  const fontsDir = resolve(__dirname, 'templates', 'fonts');
  const body = mdBodyToHtml(md);
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<style>
  @font-face { font-family: 'Space Grotesk'; src: url('file://${fontsDir}/space-grotesk-latin.woff2') format('woff2'); font-weight: 300 700; font-style: normal; }
  @font-face { font-family: 'DM Sans'; src: url('file://${fontsDir}/dm-sans-latin.woff2') format('woff2'); font-weight: 100 1000; font-style: normal; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'DM Sans', sans-serif; font-size: 10.5px; line-height: 1.65; color: #1a1a2e; background: #fff; }
  .page { padding: 16mm 18mm; }
  h1 { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.02em; margin-bottom: 10px; }
  h2 { font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: hsl(187,74%,32%); border-bottom: 1px solid hsl(187,40%,88%); padding-bottom: 3px; margin: 14px 0 7px; }
  h3 { font-size: 11px; font-weight: 600; margin: 10px 0 4px; color: #333; }
  h4 { font-size: 10.5px; font-weight: 600; margin: 8px 0 4px; color: #555; }
  p { margin-bottom: 9px; }
  strong { font-weight: 600; }
  em { font-style: italic; }
  code { font-family: 'Courier New', monospace; background: #f4f4f8; padding: 1px 4px; border-radius: 2px; font-size: 9.5px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 10px; font-size: 9.5px; }
  th { background: hsl(187,40%,95%); font-weight: 600; text-align: left; padding: 4px 8px; border: 1px solid hsl(187,40%,80%); }
  td { padding: 4px 8px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  hr { border: none; border-top: 1px solid #e0e0e0; margin: 10px 0; }
  ul, ol { padding-left: 18px; margin-bottom: 9px; }
  li { margin-bottom: 3px; }
  blockquote { border-left: 3px solid hsl(187,74%,32%); padding-left: 10px; color: #555; margin: 0 0 9px; font-style: italic; }
  a { color: hsl(187,74%,32%); text-decoration: none; }
</style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────

async function generatePDF() {
  const args = process.argv.slice(2);

  // Parse arguments
  let inputPath, outputPath, format = 'a4';

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      format = arg.split('=')[1].toLowerCase();
    } else if (!inputPath) {
      inputPath = arg;
    } else if (!outputPath) {
      outputPath = arg;
    }
  }

  if (!inputPath || !outputPath) {
    console.error('Usage: node generate-pdf.mjs <input.html> <output.pdf> [--format=letter|a4]');
    process.exit(1);
  }

  inputPath = resolve(inputPath);
  outputPath = resolve(outputPath);
  const isMarkdown = inputPath.endsWith('.md');

  // Validate format
  const validFormats = ['a4', 'letter'];
  if (!validFormats.includes(format)) {
    console.error(`Invalid format "${format}". Use: ${validFormats.join(', ')}`);
    process.exit(1);
  }

  console.log(`📄 Input:  ${inputPath}`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📏 Format: ${format.toUpperCase()}`);

  // Read HTML (or markdown) input
  let html = await readFile(inputPath, 'utf-8');

  // Convert markdown to HTML document if needed
  if (isMarkdown) {
    html = markdownToHtmlDocument(html);
  }

  // Resolve font paths relative to career-ops/fonts/
  const fontsDir = resolve(__dirname, 'fonts');
  html = html.replace(
    /url\(['"]?\.\/fonts\//g,
    `url('file://${fontsDir}/`
  );
  // Close any unclosed quotes from the replacement (handles all font formats)
  html = html.replace(
    /file:\/\/([^'")]+)\.(woff2?|ttf|otf)['"]?\)/g,
    `file://$1.$2')`
  );

  // Normalize text for ATS compatibility (issue #1)
  const normalized = normalizeTextForATS(html);
  html = normalized.html;
  const totalReplacements = Object.values(normalized.replacements).reduce((a, b) => a + b, 0);
  if (totalReplacements > 0) {
    const breakdown = Object.entries(normalized.replacements).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`🧹 ATS normalization: ${totalReplacements} replacements (${breakdown})`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // Set content with file base URL for any relative resources
    await page.setContent(html, {
      waitUntil: 'networkidle',
      baseURL: `file://${dirname(inputPath)}/`,
    });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: format,
      printBackground: true,
      margin: {
        top: '0.6in',
        right: '0.6in',
        bottom: '0.6in',
        left: '0.6in',
      },
      preferCSSPageSize: false,
    });

    // Write PDF
    const { writeFile } = await import('fs/promises');
    await writeFile(outputPath, pdfBuffer);

    // Count pages (approximate from PDF structure)
    const pdfString = pdfBuffer.toString('latin1');
    const pageCount = (pdfString.match(/\/Type\s*\/Page[^s]/g) || []).length;

    console.log(`✅ PDF generated: ${outputPath}`);
    console.log(`📊 Pages: ${pageCount}`);
    console.log(`📦 Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    return { outputPath, pageCount, size: pdfBuffer.length };
  } finally {
    await browser.close();
  }
}

generatePDF().catch((err) => {
  console.error('❌ PDF generation failed:', err.message);
  process.exit(1);
});
