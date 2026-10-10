import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/*
 * English written straight into a page never reaches the French or Kinyarwanda
 * reader. A review of the app found about 240 such strings in 45 files, all
 * sitting beside perfectly good translation keys, and nothing had been able to
 * see them: the key guard checks that keys exist, not that a page uses one.
 *
 * This looks for the three shapes they take in JSX:
 *   <p>Some words</p>          a text node on one line
 *   placeholder="Some words"   a user-facing attribute
 *   Some words                 a line of text on its own between tags
 *
 * The operator console (src/pages/Platform) is excluded: it is for the
 * platform's own staff, in English. Brand names are allowed. If this fails,
 * move the words into the translation files and use t('...'), do not extend
 * the allow-list.
 */

const SRC = path.resolve(__dirname, '..')
const ALLOWED = new Set(['Imboni', 'Imboni Logo'])
const SKIP_DIRS = ['test', 'i18n', 'node_modules', path.join('pages', 'Platform')]

const TEXT = />\s*([A-Z][A-Za-z][A-Za-z'’ ,.\-!?&/]{3,}?)\s*</g
const ATTR = /\b(?:placeholder|title|aria-label|label|alt|emptyTitle|emptyDesc|description|subtitle)="([A-Z][A-Za-z][^"{}]{3,})"/g
const BARE = /^[A-Z][A-Za-z][A-Za-z'’ ,.\-!?&/…:]{2,}$/

function* files(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (SKIP_DIRS.some(s => full.endsWith(path.sep + s) || full.includes(path.sep + s + path.sep))) continue
            yield* files(full)
        } else if (entry.name.endsWith('.jsx') && !entry.name.endsWith('.test.jsx')) {
            yield full
        }
    }
}

function findings() {
    const out = []
    for (const file of files(SRC)) {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
        lines.forEach((line, i) => {
            const trimmed = line.trim()
            if (/^(\*|\/\/|\/\*)/.test(trimmed)) return
            for (const m of line.matchAll(TEXT)) {
                const w = m[1].trim()
                if (!ALLOWED.has(w) && w !== w.toUpperCase() && !w.includes('{')) out.push(`${path.relative(SRC, file)}:${i + 1}  ${w}`)
            }
            for (const m of line.matchAll(ATTR)) {
                if (!ALLOWED.has(m[1])) out.push(`${path.relative(SRC, file)}:${i + 1}  ${m[1]}`)
            }
            const prev = (lines[i - 1] || '').trim()
            if (BARE.test(trimmed) && prev.endsWith('>') && !/^(\*|\/\/|\/\*)/.test(prev) && !ALLOWED.has(trimmed)) {
                out.push(`${path.relative(SRC, file)}:${i + 1}  ${trimmed}`)
            }
        })
    }
    return out
}

describe('hardcoded English', () => {
    it('does not appear in the pages: use t() so every language is served', () => {
        // ProgressBar and AttendanceRecord only match inside doc comments.
        const found = findings().filter(f => !/ProgressBar\.jsx|AttendanceRecord\.jsx/.test(f))
        expect(found).toEqual([])
    })
})
