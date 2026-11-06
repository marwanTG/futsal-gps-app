// Turns the single-file build (dist-artifact/index.html) into a claude.ai
// artifact page: no doctype/html/head/body tags, title first, scripts last.
// Usage: node scripts/pack-artifact.mjs [out.html]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'work/artifact/futsal-app.html';
const html = readFileSync('dist-artifact/index.html', 'utf8');

const blocks = (tag) => {
  const found = [];
  let i = 0;
  for (;;) {
    const start = html.indexOf(`<${tag}`, i);
    if (start < 0) break;
    const end = html.indexOf(`</${tag}>`, start);
    found.push(html.slice(start, end + tag.length + 3));
    i = end + 1;
  }
  return found;
};

const title = html.match(/<title>[^<]*<\/title>/)[0];
const styles = blocks('style');
const scripts = blocks('script');
const bodyStart = html.indexOf('<body>') + 6;
const body = html.slice(bodyStart, html.indexOf('</body>')).replace(/<script[\s\S]*<\/script>/g, '').trim();

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, [title, '<meta name="claude:viewport-fit-sides" content="cover">', ...styles, body, ...scripts].join('\n'));
console.log(`wrote ${out} (${(Buffer.byteLength(readFileSync(out)) / 1024).toFixed(0)} KB, ${styles.length} style, ${scripts.length} script)`);
