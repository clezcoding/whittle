#!/usr/bin/env node
/**
 * Regenerates the README screenshots (docs/screenshots/*.png) from the demo-data build of the
 * interface and from the real command line.
 *
 *   pnpm -C apps/gui build && pnpm -C apps/gui preview --port 4401 &
 *   cargo build -p whittle-cli
 *   NODE_PATH=$(npm root -g) node tools/brand/readme-shots.cjs [--app http://127.0.0.1:4401] [--cli target/debug/whittle]
 *
 * Needs: playwright (with Chromium) and Python 3 with Pillow (rounded corners and shadow).
 */
const { chromium } = require('playwright')
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const APP = arg('--app', 'http://127.0.0.1:4401')
const CLI = path.resolve(arg('--cli', 'target/debug/whittle'))
const OUT = path.resolve(arg('--out', 'docs/screenshots'))
const FONTS = path.resolve('apps/gui/public/fonts')
fs.mkdirSync(OUT, { recursive: true })

const frame = (src, dst) =>
  execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw, ImageFilter
import sys
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
r, pad = 28, 70
mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], r, fill=255)
im.putalpha(mask)
W, H = im.width + pad * 2, im.height + pad * 2
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([pad, pad + 18, pad + im.width, pad + 18 + im.height], r, fill=(0, 0, 0, 110))
shadow = shadow.filter(ImageFilter.GaussianBlur(26))
canvas.alpha_composite(shadow); canvas.alpha_composite(im, (pad, pad))
canvas.save(dst, optimize=True)
`, src, dst])

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'whittle-shots-'))

  async function app(name, scheme, steps) {
    const ctx = await browser.newContext({ viewport: { width: 1240, height: 820 }, deviceScaleFactor: 2, colorScheme: scheme })
    const p = await ctx.newPage()
    await p.goto(APP); await p.waitForTimeout(800)
    await p.getByRole('button', { name: 'Skip' }).click(); await p.waitForTimeout(500)
    await steps(p)
    const raw = path.join(tmp, name + '.png')
    await p.screenshot({ path: raw })
    frame(raw, path.join(OUT, name + '.png'))
    await ctx.close()
    console.log('wrote', name)
  }
  const scan = async (p) => { await p.getByRole('button', { name: /^Scan/ }).first().click(); await p.waitForSelector('text=Review & clean', { timeout: 20000 }); await p.waitForTimeout(1500) }

  await app('overview-dark', 'dark', scan)
  await app('overview-light', 'light', scan)
  await app('review-dark', 'dark', async (p) => {
    await scan(p); await p.keyboard.press('Control+2'); await p.waitForTimeout(700)
    await p.getByRole('button', { name: 'Why is this here?' }).first().click(); await p.waitForTimeout(500)
  })
  await app('settings-dark', 'dark', async (p) => { await p.keyboard.press('Control+,'); await p.waitForTimeout(900) })
  await app('history-dark', 'dark', async (p) => { await p.keyboard.press('Control+4'); await p.waitForTimeout(900) })
  const shot = async (key, extra) => async (p) => { await scan(p); await p.keyboard.press('Control+' + key); await p.waitForTimeout(1500); if (extra) await extra(p) }
  await app('insights-dark', 'dark', await shot('5'))
  await app('treemap-dark', 'dark', await shot('5', async (p) => { await p.evaluate(() => document.querySelector('.main').scrollTo(0, 560)); await p.waitForTimeout(900) }))
  await app('apps-dark', 'dark', await shot('6'))
  await app('rules-dark', 'dark', await shot('7', async (p) => { await p.locator('.rule__head').nth(5).click(); await p.waitForTimeout(500) }))
  await app('quarantine-dark', 'dark', await shot('8'))
  await app('palette-dark', 'dark', async (p) => { await scan(p); await p.keyboard.press('Control+k'); await p.waitForTimeout(400); await p.keyboard.type('xcode'); await p.waitForTimeout(500) })
  await app('inspector-dark', 'dark', async (p) => { await scan(p); await p.keyboard.press('Control+2'); await p.waitForTimeout(700); await p.locator('.row').first().dblclick(); await p.waitForTimeout(1100) })
  await app('insights-light', 'light', await shot('5'))

  // ---- the command line, for real, against a throw-away home
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'whittle-home-'))
  const mk = (rel, mb) => { const f = path.join(home, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.alloc(mb * 1e6)) }
  mk('Library/Caches/com.spotify.client/blob', 28); mk('Library/Caches/Google/blob', 17)
  mk('Library/Developer/Xcode/DerivedData/Atlas-bnxqkd/build', 94)
  mk('Library/Application Support/com.getdropbox.dropbox/cache.db', 13)
  mk('Developer/clared-web/node_modules/x.bin', 19); fs.writeFileSync(path.join(home, 'Developer/clared-web/package.json'), '{"name":"clared-web"}')
  mk('Developer/old-tool/target/debug/app', 46); fs.writeFileSync(path.join(home, 'Developer/old-tool/Cargo.toml'), '[package]\nname="old-tool"\n')
  mk('Library/Logs/DiagnosticReports/crash.ips', 6)
  execFileSync('find', [home, '-exec', 'touch', '-d', '120 days ago', '{}', '+'])
  const run = (...a) => { const r = spawnSync(CLI, ['--home', home, '--os', 'macos', '--no-color', ...a], { encoding: 'utf8' }); return (r.stdout + r.stderr).replace(home, '/Users/clemens').replaceAll(home, '/Users/clemens') }
  const blocks = [['whittle scan', run('scan')], ['whittle clean --risk safe --yes', run('clean', '--risk', 'safe', '--yes')], ['whittle undo', run('undo')]]
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const color = (line) => esc(line)
    .replace(/^(\s*)(safe)(\s)/, '$1<i class=s>$2</i>$3').replace(/^(\s*)(caution)(\s)/, '$1<i class=c>$2</i>$3').replace(/^(\s*)(manual)(\s)/, '$1<i class=m>$2</i>$3')
    .replace(/^(\s*[\d.]+ [KMGT]?B)(\s)/, '<b class=n>$1</b>$2').replace(/^(\S+)(\s+[\d.]+ [KMGT]?B)$/, '<b>$1</b><b class=n>$2</b>')
  const html = `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:G;src:url(file://${FONTS}/geist-mono-400-normal.woff2)}@font-face{font-family:G;font-weight:500;src:url(file://${FONTS}/geist-mono-500-normal.woff2)}
body{margin:0;background:transparent}.w{width:1240px;background:#0e1012;border:1px solid #2a2e33;border-radius:14px;overflow:hidden;font:400 15px/1.55 G,monospace;color:#eceef0}
.t{height:46px;background:#15181b;border-bottom:1px solid #2a2e33;display:flex;align-items:center;padding:0 18px;gap:9px}.t span{width:13px;height:13px;border-radius:50%;background:#ff5f57}.t span:nth-child(2){background:#febc2e}.t span:nth-child(3){background:#28c840}.t em{margin-left:14px;color:#8b939b;font-style:normal;font-size:13px}
pre{margin:0;padding:22px 28px 26px;white-space:pre-wrap;word-break:break-word;color:#c9cdd1}.p{color:#8b939b}.p b{color:#e8d2ae;font-weight:500}.p u{color:#eceef0;text-decoration:none;font-weight:500}
i{font-style:normal}.s{color:#e8d2ae}.c{color:#eceef0}.m{color:#ff3b2f}b.n{color:#e8d2ae;font-weight:500}b{color:#eceef0;font-weight:500}
</style><div class=w><div class=t><span></span><span></span><span></span><em>whittle: zsh</em></div><pre>${blocks.map(([c, o]) => `<span class=p><b>~</b> <u>${esc(c)}</u></span>\n${o.trimEnd().split('\n').map(color).join('\n')}\n`).join('\n')}</pre></div>`
  const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'load' }); await page.waitForTimeout(400)
  const raw = path.join(tmp, 'cli.png')
  await (await page.$('.w')).screenshot({ path: raw, omitBackground: true })
  frame(raw, path.join(OUT, 'cli.png')); console.log('wrote cli')
  await browser.close()
})()
