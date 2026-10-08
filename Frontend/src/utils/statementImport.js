import { parseCsv } from './exportTable'

/**
 * Turn a bank or mobile-money statement CSV into the lines the server matches.
 *
 * Banks and MoMo exports name their columns differently (Amount, Credit,
 * Narration, Details, Txn ID...), so columns are found by what the heading
 * says rather than by position. A file whose amount column cannot be found is
 * reported, not guessed at: matching money to the wrong column posts the wrong
 * payments.
 */
const COLUMNS = {
    amount:      /^(amount|credit|amount received|deposit|paid in|montant|credit amount)$/i,
    reference:   /^(reference|ref|ref no|reference no|transaction id|transaction ref|txn id|txn|financial transaction id|id)$/i,
    description: /^(description|narration|details|particulars|remarks|note|message|sender|from|payer|libell[eé])$/i,
    phone:       /^(phone|msisdn|mobile|number|phone number|sender phone|from number)$/i,
    date:        /^(date|value date|transaction date|booking date|posted)$/i,
}

export function statementRows(text) {
    const [header = [], ...records] = parseCsv(text)
    const at = {}
    header.forEach((name, i) => {
        for (const [key, pattern] of Object.entries(COLUMNS)) {
            if (at[key] === undefined && pattern.test(name.trim())) at[key] = i
        }
    })
    if (at.amount === undefined) return { error: 'amount', rows: [] }

    const get = (record, key) => (at[key] === undefined ? '' : (record[at[key]] ?? '').trim())
    const rows = records
        .map(record => ({
            amount: get(record, 'amount'), reference: get(record, 'reference'),
            description: [get(record, 'description'), at.description === undefined ? record.join(' ') : '']
                .filter(Boolean).join(' '),
            phone: get(record, 'phone'), date: get(record, 'date'),
        }))
        // A debit, a balance line or a total has no money coming in.
        .filter(row => row.amount !== '' && /\d/.test(row.amount))
    return { error: null, rows }
}
