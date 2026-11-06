// Opens dist/index.html in the installed Chrome, uploads GPX files, walks the
// setup wizard for each match, visits every tab at phone and desktop width,
// saves screenshots to work/shots and reports console errors and overflow.
// Usage: node scripts/smoke.mjs file1.gpx [file2.gpx ...]
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const files = process.argv.slice(2).map((f) => resolve(f));
mkdirSync('work/shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const shot = (page, name) => page.screenshot({ path: `work/shots/${name}.jpg`, fullPage: !name.includes('-w'), type: 'jpeg', quality: 60 });
const overflow = async (page, name, where) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (o > 1) errors.push(`${name}: ${where} overflows by ${o}px`);
};

for (const [name, viewport] of [['phone', { width: 360, height: 780 }], ['desk', { width: 1280, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.waitForSelector('.welcome');
  await shot(page, `${name}-empty`);
  await page.setInputFiles('input[type=file]', files);
  await page.waitForSelector('.fab');
  await page.click('.bottom-nav button:nth-child(5)');
  await page.waitForSelector('.match-list li');

  const rows = await page.$$('.match-list li');
  for (let r = 0; r < rows.length; r++) {
    if (!(await page.$('.match-list'))) await page.click('.bottom-nav button:nth-child(5)');
    await page.click(`.match-list li:nth-child(${r + 1}) .row-actions .btn`);
    await page.waitForSelector('.sheet');
    const trim = await page.$('.step .hint .btn');
    if (trim) await trim.click();
    if (r === 0) await shot(page, `${name}-w1`);
    await page.click('.sheet-foot .btn.primary');
    const gk = await page.$('.stops .choice button');
    if (gk) await gk.click();
    if (r === 0) await shot(page, `${name}-w2`);
    await page.click('.sheet-foot .btn.primary');
    // Satellite pins when online, the movement drawing otherwise.
    await page.waitForSelector('.sat-pin, .picker');
    await page.waitForTimeout(800);
    const pin = await page.$('.sat-pin');
    if (pin) await pin.click();
    else await ((await page.$('.tap.suggest')) ?? (await page.$('.tap.bottom'))).click();
    if (r === 0) { await overflow(page, name, 'wizard goal'); await shot(page, `${name}-w3`); }
    await page.click('.sheet-foot .btn.primary');
    await page.click('.sheet-foot .btn.primary');
  }

  const tabs = await page.$$eval('.bottom-nav button', (b) => b.map((x) => x.textContent));
  for (let i = 0; i < tabs.length; i++) {
    await page.click(`.bottom-nav button:nth-child(${i + 1})`);
    await page.waitForTimeout(250);
    await overflow(page, name, `tab ${tabs[i]}`);
    await shot(page, `${name}-${String(i).padStart(2, '0')}`);
  }
  // Pitch sub-views.
  await page.click('.bottom-nav button:nth-child(2)');
  const sub = await page.$$('.tabs-inline button');
  for (let i = 1; i < sub.length; i++) {
    await page.click(`.tabs-inline button:nth-child(${i + 1})`);
    await page.waitForTimeout(200);
    await shot(page, `${name}-field-${i}`);
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors, no overflow');
