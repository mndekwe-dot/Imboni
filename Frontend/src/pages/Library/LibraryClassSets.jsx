import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClassFilter } from '../../components/ui/ClassFilter'
import { SearchBar } from '../../components/ui/SearchBar'
import { ListSection } from '../../components/ui/ListSection'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getBooks, getClassClearance, issueClassSet } from '../../api/library'
import { formatAmount } from '../Finance/FinanceShell'

/** A single year, not "every year of a section": a class set goes to one class. */
const singleYear = grade => (grade && !grade.includes(',') ? grade : '')

/**
 * Start of term: hand a textbook to a whole class. End of term: who in a class
 * still has a book out or a fine unpaid, before the school lets them go.
 */
export function ClassSetsPanel() {
    const { t } = useTranslation()
    const toast = useToast()
    const [klass, setKlass] = useState({ grade: '', stream: '' })
    const year = singleYear(klass.grade)

    return (
        <>
            <ClassFilter grade={klass.grade} stream={klass.stream} onChange={setKlass} />
            <IssueSet year={year} stream={klass.stream} toast={toast} t={t} />
            <Clearance year={year} stream={klass.stream} toast={toast} t={t} />
        </>
    )
}

function IssueSet({ year, stream, toast, t }) {
    const [q, setQ] = useState('')
    const [books, setBooks] = useState([])
    const [book, setBook] = useState(null)
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState(null)

    useEffect(() => {
        if (!q.trim()) { setBooks([]); return }
        let alive = true
        getBooks({ q: q.trim(), available: 'true' })
            .then(d => { if (alive) setBooks(Array.isArray(d) ? d.slice(0, 6) : []) })
            .catch(() => { if (alive) setBooks([]) })
        return () => { alive = false }
    }, [q])

    async function issue() {
        setBusy(true); setResult(null)
        try {
            const r = await issueClassSet({ book: book.id, grade: year, stream })
            setResult(r)
            toast.success(t('library.classes.result', { issued: r.issued, size: r.class_size }))
        } catch (e) {
            toast.error(errorMessage(e, t('library.classes.issueFailed')))
        } finally { setBusy(false) }
    }

    return (
        <ListSection icon="library_books" title={t('library.classes.setTitle')}>
            <p className="u-muted u-sm">{t('library.classes.setNote')}</p>
            <SearchBar value={q} onChange={setQ} placeholder={t('library.classes.findBook')} />
            {q.trim() && books.length === 0 && <p className="u-muted">{t('library.classes.noBooks')}</p>}
            <ul className="row-list mt-1">
                {books.map(b => (
                    <li key={b.id} className="row-item">
                        <button className="row-item-button" onClick={() => { setBook(b); setResult(null) }}>
                            <span className="row-main">
                                <span className="u-strong u-sm">{b.title}</span>
                                <span className="text-xs-muted">{b.author} · {t('library.classes.available', { count: b.available_copies })}</span>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {book && <p className="u-strong mt-1">{t('library.classes.chosen', { title: book.title })}</p>}
            <button className="btn btn-primary mt-1" onClick={issue} disabled={busy || !book || !year}>
                {t('library.classes.issue')}
            </button>
            {(!book || !year) && <p className="text-xs-muted">{t('library.classes.chooseFirst')}</p>}
            {result && (
                <div className="mt-1" role="status">
                    <p>{t('library.classes.result', { issued: result.issued, size: result.class_size })}</p>
                    {result.short.length > 0 && <p className="form-error">{t('library.classes.short', { names: result.short.join(', ') })}</p>}
                    {result.skipped.length > 0 && (
                        <p className="u-muted u-sm">
                            {t('library.classes.skipped', { list: result.skipped.map(s => `${s.student} (${s.reason})`).join('; ') })}
                        </p>
                    )}
                </div>
            )}
        </ListSection>
    )
}

function Clearance({ year, stream, toast, t }) {
    const [out, setOut] = useState(null)
    const [busy, setBusy] = useState(false)

    async function check() {
        setBusy(true)
        try {
            setOut(await getClassClearance({ grade: year, stream }))
        } catch (e) {
            toast.error(errorMessage(e, t('library.classes.checkFailed')))
        } finally { setBusy(false) }
    }

    return (
        <ListSection icon="verified" title={t('library.classes.clearTitle')}>
            <p className="u-muted u-sm">{t('library.classes.clearNote')}</p>
            <button className="btn btn-outline" onClick={check} disabled={busy || !year}>
                {t('library.classes.check')}
            </button>
            {out && (out.not_cleared.length === 0 ? (
                <p className="mt-1" role="status">{t('library.classes.allClear')}</p>
            ) : (
                <>
                    <p className="u-strong mt-1" role="status">
                        {t('library.classes.notCleared', { count: out.not_cleared.length, size: out.class_size })}
                    </p>
                    <ul className="row-list">
                        {out.not_cleared.map(r => (
                            <li key={r.student_id} className="row-item">
                                <span className="row-main">
                                    <span className="u-strong u-sm">{r.student}</span>
                                    <span className="text-xs-muted">
                                        {r.books_out.length > 0 && t('library.classes.booksOut', { titles: r.books_out.map(b => b.title).join(', ') })}
                                        {r.books_out.length > 0 && Number(r.owed) > 0 && ' · '}
                                        {Number(r.owed) > 0 && t('library.classes.owes', { amount: formatAmount(r.owed) })}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            ))}
        </ListSection>
    )
}
