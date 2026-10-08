import { describe, it, expect } from 'vitest'
import { parseCsv } from './exportTable'
import { matchScores, scoreTemplate } from './scoreImport'

const STUDENTS = [
    { student_id: 'u1', student_code: 'S001', full_name: 'Uwase, Amina' },
    { student_id: 'u2', student_code: 'S002', full_name: 'Habimana Eric' },
]

describe('parseCsv', () => {
    it('reads quoted fields, doubled quotes, a BOM and CRLF', () => {
        expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']])
    })
    it('reads a semicolon file from a French-locale Excel', () => {
        expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
    })
    it('drops blank lines', () => {
        expect(parseCsv('a,b\n\n1,2\n,\n')).toEqual([['a', 'b'], ['1', '2']])
    })
})

describe('matchScores', () => {
    it('round-trips the template it produced', () => {
        const t = scoreTemplate(STUDENTS)
        expect(t.rows[0]).toEqual(['S001', 'Uwase, Amina', '', ''])
    })

    it('applies scores by student code, with comments', () => {
        const csv = 'student_code,student_name,score,remarks\nS001,"Uwase, Amina",18,Good\nS002,Habimana Eric,15.5,'
        const r = matchScores(csv, STUDENTS, 20)
        expect(r.scores).toEqual({ u1: '18', u2: '15.5' })
        expect(r.notes).toEqual({ u1: 'Good' })
        expect(r.applied).toBe(2)
    })

    it('accepts a decimal comma and ignores blank scores', () => {
        const r = matchScores('student_code;score\nS001;17,5\nS002;', STUDENTS, 20)
        expect(r.scores).toEqual({ u1: '17.5' })
    })

    it('reports unknown codes and out-of-range or non-numeric scores without applying them', () => {
        const r = matchScores('student_code,score\nS001,25\nS002,abs\nZ999,10', STUDENTS, 20)
        expect(r.applied).toBe(0)
        expect(r.invalid).toEqual(['S001 (25)', 'S002 (abs)'])
        expect(r.unknown).toEqual(['Z999'])
    })

    it('flags a file without the code and score columns', () => {
        expect(matchScores('name,mark\nA,1', STUDENTS, 20).missingColumns).toBe(true)
    })
})
