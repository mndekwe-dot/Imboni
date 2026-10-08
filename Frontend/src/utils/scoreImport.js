/**
 * Marks typed into a spreadsheet, matched back to the class list.
 *
 * The template a teacher downloads has one row per student, keyed by the
 * student code printed on every roll; they fill the score column and upload it.
 * Matching is by that code, never by name - two Aminas share a class.
 */
import { parseCsv } from './exportTable'

export const SCORE_COLUMNS = ['student_code', 'student_name', 'score', 'remarks']

export function scoreTemplate(students) {
    return {
        columns: SCORE_COLUMNS,
        rows: students.map(s => [s.student_code, s.full_name, '', '']),
    }
}

/**
 * @returns {{ scores, notes, applied, unknown, invalid, missingColumns }}
 *   scores/notes are keyed by student_id; unknown holds codes that are not in
 *   the class, invalid holds "CODE (value)" for scores that are not a number
 *   from 0 to the maximum. Nothing invalid is applied.
 */
export function matchScores(text, students, max) {
    const out = { scores: {}, notes: {}, applied: 0, unknown: [], invalid: [], missingColumns: false }
    const [header = [], ...rows] = parseCsv(text)
    const col = name => header.findIndex(h => h.trim().toLowerCase() === name)
    const iCode = col('student_code'), iScore = col('score'), iNote = col('remarks')
    if (iCode === -1 || iScore === -1) return { ...out, missingColumns: true }

    const byCode = new Map(students.map(s => [String(s.student_code).trim().toLowerCase(), s]))
    for (const r of rows) {
        const code = (r[iCode] || '').trim()
        const raw  = (r[iScore] || '').trim().replace(',', '.')
        if (!code) continue
        const student = byCode.get(code.toLowerCase())
        if (!student) { out.unknown.push(code); continue }
        if (iNote !== -1 && (r[iNote] || '').trim()) out.notes[student.student_id] = r[iNote].trim()
        if (raw === '') continue
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0 || (max > 0 && n > max)) { out.invalid.push(`${code} (${r[iScore].trim()})`); continue }
        out.scores[student.student_id] = String(n)
        out.applied++
    }
    return out
}
