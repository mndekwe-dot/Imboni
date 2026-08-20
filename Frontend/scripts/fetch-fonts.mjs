/**
 * Download the web fonts this app actually uses into public/fonts/.
 *
 * Two things happen here that matter:
 *
 *  1. The icon font is SUBSET to the icons the code renders. The full Material
 *     Symbols set is ~361 KB; the icons we use come to ~15 KB. Downloading
 *     thousands of glyphs to show 172 of them is most of the font payload.
 *
 *  2. Because the subset is built from a scan of src/, adding a new icon to a
 *     component and not re-running this script means that icon renders as a
 *     blank box. src/test/icon-subset.test.js fails loudly when that happens —
 *     it re-scans and compares against the manifest written here.
 *
 * Run:  npm run fonts
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

// icon-subset.test.js imports collectIconNames from here, and under vitest
// import.meta.url is not a file:// URL — fall back to the working directory,
// which for both `npm run fonts` and the test run is the Frontend root.
const ROOT = (() => {
    try { return fileURLToPath(new URL('..', import.meta.url)) }
    catch { return process.cwd() }
})()
const SRC = join(ROOT, 'src')
const OUT = join(ROOT, 'public', 'fonts')

// Google serves woff2 only to browsers that advertise support.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry)
        if (statSync(p).isDirectory()) walk(p, out)
        else if (['.jsx', '.js'].includes(extname(p)) && !p.includes('.test.')) out.push(p)
    }
    return out
}

/** The official list of Material Symbols names, used to tell an icon from a
 *  stray word. Without it a ternary like `{open ? 'expand_less' : 'add'}` also
 *  yields "open", and class fragments leak in as icons that do not exist. */
export async function validIconNames() {
    const res = await fetch('https://fonts.google.com/metadata/icons?incomplete=1&key=material_symbols')
    if (!res.ok) throw new Error(`icon metadata: ${res.status}`)
    const json = JSON.parse((await res.text()).replace(/^\)\]\}'/, ''))
    return new Set(json.icons.map(i => i.name))
}

/**
 * Every Material Symbols name this codebase could render.
 *
 * Two passes, because icons reach the DOM two different ways:
 *
 *   1. Written straight into a span — `<span className="…">edit</span>`. The
 *      whole span body is scanned, so both branches of a ternary are found.
 *   2. Passed as DATA and rendered through a variable — nav configs
 *      (`{ icon: 'dashboard' }`), stat-card arrays, activity-type maps. Pass 1
 *      cannot see these at all; missing them is what left the sidebar
 *      rendering the word "DASHBOARD" instead of the icon.
 *
 * Pass 2 therefore accepts ANY string literal that is a real icon name. That
 * over-collects a little — "add", "search" and "home" are both ordinary words
 * and real icons — but a handful of spare glyphs costs a couple of KB, while a
 * missed one is a visible defect in production. Err toward including.
 */
export function collectIconNames(valid, dir = SRC) {
    const names = new Set()
    const span = /material-symbols-rounded[^>]*>([\s\S]*?)<\/span>/g
    const literal = /['"`]([a-z][a-z0-9_]*)['"`]/g
    for (const file of walk(dir)) {
        const src = readFileSync(file, 'utf8')
        for (const m of src.matchAll(span)) {
            for (const token of m[1].matchAll(/[a-z][a-z0-9_]*/g)) {
                if (valid.has(token[0])) names.add(token[0])
            }
        }
        for (const m of src.matchAll(literal)) {
            if (valid.has(m[1])) names.add(m[1])
        }
    }
    return [...names].sort()
}

async function css(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
    return res.text()
}

async function download(url, file) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`${res.status} for ${url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(join(OUT, file), buf)
    return buf.length
}

/** Pull the woff2 url for one named unicode subset out of a Google CSS response. */
function subsetUrl(sheet, subset) {
    const re = new RegExp(`/\\*\\s*${subset}\\s*\\*/\\s*@font-face\\s*\\{([^}]*)\\}`)
    const block = sheet.match(re)
    if (!block) throw new Error(`no "${subset}" subset in the stylesheet`)
    const url = block[1].match(/url\((https:\/\/[^)]+)\)/)
    if (!url) throw new Error(`no url in the "${subset}" block`)
    return url[1]
}

/** The unicode-range Google pairs with a subset — reused verbatim in our @font-face. */
function subsetRange(sheet, subset) {
    const re = new RegExp(`/\\*\\s*${subset}\\s*\\*/\\s*@font-face\\s*\\{([^}]*)\\}`)
    return sheet.match(re)[1].match(/unicode-range:\s*([^;]+);/)[1].trim()
}

const KB = n => `${(n / 1024).toFixed(1)} KB`

async function main() {
    mkdirSync(OUT, { recursive: true })

    // ── Inter, as one variable file per subset ────────────────────────────────
    // The full 100..900 axis costs the same bytes as naming individual weights:
    // Google ships one variable file per subset either way.
    const interCss = await css('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap')
    const ranges = {}
    for (const subset of ['latin', 'latin-ext']) {
        const size = await download(subsetUrl(interCss, subset), `inter-${subset}.woff2`)
        ranges[subset] = subsetRange(interCss, subset)
        console.log(`  inter-${subset}.woff2`.padEnd(28) + KB(size))
    }

    // ── Material Symbols, subset to the icons we render ───────────────────────
    const valid = await validIconNames()
    const icons = collectIconNames(valid)
    const iconCss = await css(
        'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0'
        + `&icon_names=${icons.join(',')}`,
    )
    const iconUrl = iconCss.match(/url\(([^)]+)\)/)[1]
    const iconSize = await download(iconUrl, 'material-symbols-subset.woff2')
    console.log(`  material-symbols-subset.woff2`.padEnd(28) + KB(iconSize) + `  (${icons.length} icons)`)

    writeFileSync(
        join(ROOT, 'scripts', 'icons.manifest.json'),
        JSON.stringify({ note: 'Generated by scripts/fetch-fonts.mjs — run `npm run fonts` after adding an icon.', icons }, null, 2) + '\n',
    )

    // Cached beside the script, NOT in public/ — a build-time reference, not
    // something users download. icon-subset.test.js uses it to tell a real icon
    // name from an ordinary identifier that happens to sit inside a span.
    writeFileSync(
        join(ROOT, 'scripts', 'icon-names.cache.json'),
        JSON.stringify([...valid].sort()) + '\n',
    )

    // unicode-range must match what we downloaded, so emit it rather than hand-copy.
    writeFileSync(
        join(ROOT, 'scripts', 'unicode-ranges.json'),
        JSON.stringify(ranges, null, 2) + '\n',
    )
    console.log(`\n  wrote ${OUT}`)
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fetch-fonts.mjs')) {
    main().catch(e => { console.error(e); process.exit(1) })
}
