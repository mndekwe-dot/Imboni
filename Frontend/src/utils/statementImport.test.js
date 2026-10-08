import { describe, it, expect } from 'vitest'
import { statementRows } from './statementImport'

describe('statementRows', () => {
    it('finds the columns by what the heading says, wherever they sit', () => {
        const csv = 'Date,Narration,Txn ID,Credit\n2026-10-01,FEES ADM002,MP1,"50,000"\n2026-10-02,Lunch,MP2,10000\n'
        const { error, rows } = statementRows(csv)
        expect(error).toBeNull()
        expect(rows).toEqual([
            { amount: '50,000', reference: 'MP1', description: 'FEES ADM002', phone: '', date: '2026-10-01' },
            { amount: '10000', reference: 'MP2', description: 'Lunch', phone: '', date: '2026-10-02' },
        ])
    })

    it('reads a semicolon file saved by a French-locale Excel', () => {
        const { rows } = statementRows('Date;Details;Amount;Phone\n2026-10-01;Frais;30000;0788123456\n')
        expect(rows[0]).toMatchObject({ amount: '30000', phone: '0788123456', description: 'Frais' })
    })

    it('drops lines with no money in: debits, balances, blanks', () => {
        const { rows } = statementRows('Amount,Details\n,Opening balance\n20000,Fees\nTotal,\n')
        expect(rows.map(r => r.amount)).toEqual(['20000'])
    })

    it('says so when there is no amount column rather than guessing', () => {
        expect(statementRows('Date,Narration\n2026-10-01,x\n')).toEqual({ error: 'amount', rows: [] })
    })

    it('uses the whole line as the description when no description column exists', () => {
        const { rows } = statementRows('Amount,Txn\n40000,pay ADM005 term1\n')
        expect(rows[0].description).toContain('ADM005')
    })
})
