/**
 * One-off codemod: use torboxFetch for all TorBox API proxy routes.
 * Run: bun scripts/apply-torbox-fetch.js
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const IMPORT_LINE = "import { torboxFetch } from '@/app/api/lib/torboxFetch';";

async function walk(dir, files = []) {
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) files = await walk(path, files);
    else if (name.name.endsWith('.js')) files.push(path);
  }
  return files;
}

function addImport(content) {
  if (content.includes("from '@/app/api/lib/torboxFetch'")) return content;
  const constantsImport = /import .+ from '@\/components\/constants';?\n/;
  if (constantsImport.test(content)) {
    return content.replace(constantsImport, (m) => m + IMPORT_LINE + '\n');
  }
  const firstImport = content.match(/^import .+;\n/m);
  if (firstImport) {
    const idx = content.indexOf(firstImport[0]) + firstImport[0].length;
    return content.slice(0, idx) + IMPORT_LINE + '\n' + content.slice(idx);
  }
  return IMPORT_LINE + '\n' + content;
}

function applyReplacements(content) {
  let next = content;

  next = next.replace(/await fetch\(`\$\{API_BASE\}/g, 'await torboxFetch(`${API_BASE}');
  next = next.replace(
    /await fetch\(`\$\{API_SEARCH_BASE\}/g,
    'await torboxFetch(`${API_SEARCH_BASE}'
  );
  next = next.replace(/fetch\(\s*\n\s*`(\$\{API_BASE\})/g, 'torboxFetch(\n      `$1');
  next = next.replace(/(?<![\w.])fetch\(`\$\{API_BASE\}/g, 'torboxFetch(`${API_BASE}');
  next = next.replace(
    /(?<![\w.])fetch\(`\$\{API_SEARCH_BASE\}/g,
    'torboxFetch(`${API_SEARCH_BASE}'
  );
  next = next.replace(/await fetch\(API_BASE/g, 'await torboxFetch(API_BASE');
  next = next.replace(/await fetch\(apiUrl,/g, 'await torboxFetch(apiUrl,');
  next = next.replace(/await fetch\(endpoint,/g, 'await torboxFetch(endpoint,');
  next = next.replace(
    /await fetch\(\s*\n\s*`(\$\{API_BASE\}|\$\{API_SEARCH_BASE\})/g,
    'await torboxFetch(\n      `$1'
  );

  // Manual AbortController blocks superseded by torboxFetch default timeout
  next = next.replace(
    /\s*const controller = new AbortController\(\);\n\s*const timeoutId = setTimeout\(\(\) => controller\.abort\(\), \d+\);[^\n]*\n/g,
    '\n'
  );
  next = next.replace(/\s*clearTimeout\(timeoutId\);\n/g, '\n');
  next = next.replace(/\s*signal: controller\.signal,?\n/g, '\n');
  next = next.replace(/\s*signal: AbortSignal\.timeout\(\d+\),?\n/g, '\n');

  return next;
}

const apiRoot = join(import.meta.dir, '../src/app/api');
const files = await walk(apiRoot);

for (const file of files) {
  if (file.includes('torboxFetch.js')) continue;
  let content = await readFile(file, 'utf8');
  if (!content.includes('API_BASE') && !content.includes('API_SEARCH_BASE')) continue;
  if (!content.includes('fetch(')) continue;

  const updated = applyReplacements(addImport(content));
  if (updated !== content) {
    await writeFile(file, updated);
    console.log('updated', file.replace(apiRoot + '/', ''));
  }
}
