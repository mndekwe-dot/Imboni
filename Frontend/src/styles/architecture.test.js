import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Guards the rules in ARCHITECTURE.md that a machine can check.
 *
 * These are ratchets, not pass/fail gates. Each baseline is what was true when
 * the guard was written; the assertion is `<=`, so a new violation fails, and a
 * `.toBe` on the exact count means fixing one without lowering the baseline
 * fails too. The numbers only move down.
 *
 * Why it exists: the shared components (StatCard, DataTable, EmptyState,
 * WelcomeBanner) were already there and already used by most pages, but 47
 * other pages had copied their markup and renamed the classes. Each copy then
 * needed its own CSS in a portal stylesheet, which is how one stat tile ended
 * up defined nine times and why changing it meant editing seven files.
 *
 * Known undercount: a page that uses the real component AND still has a
 * leftover hand-rolled copy is not flagged (AdminStaff renders <DataTable> but
 * also keeps an .adm-table-wrap). Deliberate - the ratchet should never report
 * a violation it cannot point at cleanly. Partial migrations get caught by eye.
 */

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name)
    return e.isDirectory() ? walk(p)
        : (p.endsWith('.jsx') && !p.includes('.test.')) ? [p] : []
})
const PAGES = walk('src/pages')
const read = f => readFileSync(f, 'utf8')

/* A page "hand-rolls" a component when it uses that component's shape under its
   own class names without importing the real one. */
const HAND_ROLLED = {
    /* Two exclusions, both genuine:
       `mini-` is the shared .mini-stat in components.css - a number and a
       caption with no icon chip, which is a different control from StatCard,
       not a copy of it.
       `mockup-` is the fake dashboard drawn inside the landing page's product
       shot. It is an illustration of a stat card, not one. */
    StatCard: /className="[^"]*\b(?!mini-|mockup-)[a-z]+-stat-(card|value|label|icon)\b/,
    // A portal-prefixed wrapper only. `.data-table-wrap` is the sanctioned
    // plain table in tables.css: markup that manages its own rows (planners,
    // timetables, rosters) is meant to use it rather than DataTable, which
    // brings pagination and an empty state a planner grid must not have.
    DataTable: /className="[^"]*\b(?!data-)[a-z]+-table-wrap\b/,
    /* The full-panel empty state only. `-empty-note` / `-empty-hint` were also
       matched here at first, but those are the one-line "nothing yet" inside a
       card - rendering <EmptyState>'s icon circle and coloured strip there
       would be wrong. They are now the shared `.empty-note` in components.css,
       which is a style, not a component. */
    EmptyState: /className="[^"]*\b[a-z]+-empty-state\b/,
    WelcomeBanner: /className="[^"]*\b[a-z]+-welcome-(banner|title|sub|greeting)\b/,
}

/* Class prefixes each portal directory is allowed to use. Anything else here
   means a page is reaching into another portal's stylesheet. */
const OWN_PREFIXES = {
    Dis: ['disc', 'dis'], Dos: ['dos', 'es'], Admin: ['adm'],
    Matron: ['mat', 'health', 'comms'], Student: ['student', 'stu', 'sqz', 'cal'],
    Teacher: ['tch', 'teacher', 'tt'], Parent: ['par', 'pc'],
}

/* `tt-` is the TIMETABLE grid, and timetable.css is shared: five portals render
   <Timetable>, so `tt-` classes appearing in a DOS, Discipline or Matron page
   are not that page reaching into Teacher's stylesheet. It is listed under
   Teacher above only because that is the portal whose own pages use it most.
   Counting it as foreign made the ratchet report seven violations that were
   nothing of the kind — and, worse, gave it slack: real violations could be
   introduced and offset by removing an innocent `tt-` use, with the exact-match
   assertion below still passing. */
const SHARED_PREFIXES = ['tt']
const ALL_PREFIXES = [...new Set(Object.values(OWN_PREFIXES).flat())]
    .filter(p => !SHARED_PREFIXES.includes(p))

function handRolledPages() {
    const out = []
    for (const f of PAGES) {
        const src = read(f)
        for (const [name, re] of Object.entries(HAND_ROLLED))
            if (re.test(src) && !new RegExp(`<${name}\\b`).test(src)) out.push(`${f} (${name})`)
    }
    return out
}

function foreignPrefixUses() {
    const out = []
    for (const f of PAGES) {
        const dir = Object.keys(OWN_PREFIXES).find(d => f.replace(/\\/g, '/').includes(`/pages/${d}/`))
        if (!dir) continue
        const src = read(f)
        const classes = new Set((src.match(/className="[^"]*"/g) ?? [])
            .flatMap(m => m.match(/\b[a-z]+-[a-z-]+\b/g) ?? []))
        for (const cls of classes) {
            const prefix = cls.split('-')[0]
            if (ALL_PREFIXES.includes(prefix) && !OWN_PREFIXES[dir].includes(prefix))
                out.push(`${f} uses .${cls}`)
        }
    }
    return out
}

describe('style architecture', () => {
    // Lower these as pages migrate. Never raise them.
    // MAX_HAND_ROLLED reached 0: every page that had copied a shared component
    // now renders it instead. Keep it there - any rise is a new copy.
    const MAX_HAND_ROLLED = 0
    const MAX_FOREIGN_PREFIX = 38

    it('does not hand-roll components that already exist', () => {
        const found = handRolledPages()
        // Reported in full so a failure names the page, not just a number.
        expect(found.length, `hand-rolled:\n${found.join('\n')}`).toBeLessThanOrEqual(MAX_HAND_ROLLED)
    })

    it('keeps the hand-rolled baseline honest', () => {
        // Fails when someone fixes pages without lowering MAX_HAND_ROLLED, so
        // the ratchet cannot silently stall with slack in it.
        expect(handRolledPages().length).toBe(MAX_HAND_ROLLED)
    })

    it('does not reach into another portal\'s classes', () => {
        const found = foreignPrefixUses()
        expect(found.length, `foreign prefixes:\n${found.join('\n')}`).toBeLessThanOrEqual(MAX_FOREIGN_PREFIX)
    })

    it('keeps the foreign-prefix baseline honest', () => {
        expect(foreignPrefixUses().length).toBe(MAX_FOREIGN_PREFIX)
    })

    it('defines colour literals only in index.css', () => {
        /* Portal stylesheets must spend tokens. index.css owns the values, and
           portal-theme.css is allowed white/black overlays for dark chrome. */
        const offenders = []
        for (const f of readdirSync('src/styles').filter(f => f.endsWith('.css'))) {
            if (f === 'portal-theme.css') continue
            const css = readFileSync(join('src/styles', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
            const hits = (css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])
                .filter(h => !/^#(fff|ffffff|000|000000)$/i.test(h))
            if (hits.length) offenders.push(`${f}: ${hits.length}`)
        }
        // Baseline only - this one is large and comes down with the migration.
        expect(offenders.length).toBeLessThanOrEqual(23)
    })
})
