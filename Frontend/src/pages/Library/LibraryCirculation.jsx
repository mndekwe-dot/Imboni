import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { TabGroup } from '../../components/ui/TabGroup'
import { FilterBar } from '../../components/ui/FilterBar'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import { StudentSearchPicker } from '../../components/ui/StudentSearchPicker'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import {
    getFines, getLoans, getMembers, issueLoan, payFine, renewLoan, returnLoan, waiveFine,
} from '../../api/library'
import { LibraryShell } from './LibraryShell'

const LOAN_FILTERS = ['open', 'overdue', 'returned']

/**
 * The desk. Issue a book, take one back, chase the late ones, settle a fine.
 *
 * The issue form is the top of the page rather than a dialog: it is the thing
 * the librarian does fifty times a morning, and a dialog would mean two clicks
 * before the barcode field has focus.
 */
export function LibraryCirculation() {
    const { t } = useTranslation()
    const toast = useToast()

    const [searchParams, setSearchParams] = useSearchParams()
    const tabParam = searchParams.get('tab')
    const activeTab = tabParam === 'fines' ? 'fines' : 'loans'
    const setActiveTab = tab => setSearchParams(tab === 'fines' ? { tab: 'fines' } : {},
        { replace: true })
    // /library/circulation?status=overdue is where the dashboard's "chase these"
    // tile points, so the filter has to be readable from the URL.
    const statusParam = searchParams.get('status')
    const [status, setStatus] = useState(
        LOAN_FILTERS.includes(statusParam) ? statusParam : 'open')

    const [loans, setLoans]     = useState([])
    const [fines, setFines]     = useState([])
    const [loading, setLoading] = useState(true)

    const loadLoans = useCallback(() => {
        setLoading(true)
        getLoans({ status })
            .then(d => setLoans(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [status, toast, t])

    const loadFines = useCallback(() => {
        getFines({ status: 'outstanding' })
            .then(d => setFines(Array.isArray(d) ? d : []))
            .catch(() => setFines([]))
    }, [])

    useEffect(() => { loadLoans() }, [loadLoans])
    useEffect(() => { loadFines() }, [loadFines])

    async function handleReturn(loan) {
        try {
            const result = await returnLoan(loan.id)
            loadLoans()
            loadFines()
            // The desk needs to know whether to shelve the book or put it aside,
            // and whether a fine was raised. Both come back on the response.
            if (result?.held_for) {
                toast.success(t('library.circulation.holdFor', { name: result.held_for.name }))
            } else if (result?.fine) {
                toast.success(t('library.circulation.returnedWithFine', { amount: result.fine.amount }))
            } else {
                toast.success(t('library.circulation.returned'))
            }
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    async function handleRenew(loan) {
        try {
            await renewLoan(loan.id)
            loadLoans()
            toast.success(t('library.circulation.renewed'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    async function handleFine(fine, action) {
        try {
            if (action === 'pay') await payFine(fine.id)
            else await waiveFine(fine.id, '')
            loadFines()
            toast.success(t(action === 'pay' ? 'library.fines.paid' : 'library.fines.waived'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    return (
        <LibraryShell
            title={t('library.circulation.title')}
            subtitle={t('library.circulation.subtitle')}
        >
            <TabGroup
                tabs={[
                    { key: 'loans', label: t('library.circulation.loansTab'), icon: 'swap_horiz' },
                    { key: 'fines', label: t('library.circulation.finesTab'), icon: 'payments',
                      count: fines.length },
                ]}
                value={activeTab}
                onChange={setActiveTab}
                label={t('library.circulation.title')}
                idPrefix="lib-circ-"
            />

            {activeTab === 'loans' && (
                <div id="lib-circ-panel-loans" role="tabpanel" aria-labelledby="lib-circ-tab-loans">
                    <IssuePanel onIssued={() => { loadLoans(); }} />

                    <div className="toolbar-card mb-1-5">
                        <FilterBar
                            options={LOAN_FILTERS.map(key => ({
                                key, label: t(`library.circulation.filter.${key}`),
                            }))}
                            active={status}
                            onChange={next => {
                                setStatus(next)
                                setSearchParams(next === 'open' ? {} : { status: next }, { replace: true })
                            }}
                        />
                    </div>

                    <ListSection
                        icon="swap_horiz"
                        title={t(`library.circulation.filter.${status}`)}
                        count={loading ? null : t('library.loanCount', { count: loans.length })}
                    >
                        {loading ? (
                            <p className="u-muted">{t('common.loading')}</p>
                        ) : loans.length === 0 ? (
                            <EmptyState
                                icon="task_alt"
                                title={t(`library.circulation.empty.${status}`)}
                                description={t('library.circulation.emptyDesc')}
                            />
                        ) : (
                            <ul className="lib-loan-list">
                                {loans.map(loan => (
                                    <LoanRow key={loan.id} loan={loan}
                                        onReturn={() => handleReturn(loan)}
                                        onRenew={() => handleRenew(loan)} />
                                ))}
                            </ul>
                        )}
                    </ListSection>
                </div>
            )}

            {activeTab === 'fines' && (
                <div id="lib-circ-panel-fines" role="tabpanel" aria-labelledby="lib-circ-tab-fines">
                    <DataTable
                        title={t('library.fines.outstanding')}
                        data={fines}
                        columns={[
                            t('library.fields.borrower'), t('library.fields.title'),
                            t('library.fines.daysLate'), t('library.fines.amount'),
                            t('common.actions'),
                        ]}
                        emptyIcon="payments"
                        emptyTitle={t('library.fines.none')}
                        emptyDesc={t('library.fines.noneDesc')}
                        renderRow={fine => (
                            <tr key={fine.id}>
                                <td><strong>{fine.borrower_detail?.name}</strong></td>
                                <td>{fine.book_title}</td>
                                <td>{fine.days_late}</td>
                                <td><strong>{fine.amount}</strong></td>
                                <td className="action-cell">
                                    <button className="btn btn-outline btn-sm"
                                        onClick={() => handleFine(fine, 'waive')}>
                                        {t('library.fines.waive')}
                                    </button>
                                    <button className="btn btn-primary btn-sm"
                                        onClick={() => handleFine(fine, 'pay')}>
                                        {t('library.fines.markPaid')}
                                    </button>
                                </td>
                            </tr>
                        )}
                    />
                </div>
            )}
        </LibraryShell>
    )
}

/** Scan a copy, pick a borrower, hand it over. */
function IssuePanel({ onIssued }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [code, setCode]         = useState('')
    const [borrower, setBorrower] = useState(null)
    const [busy, setBusy]         = useState(false)

    const searchMembers = useCallback(q => getMembers({ q }).then(rows =>
        // The picker wants {id, name, ...}; members already arrive that way,
        // with the class label the librarian needs to tell two Amina Uwases apart.
        (Array.isArray(rows) ? rows : []).map(m => ({
            id: m.id,
            name: m.name,
            student_id: m.student_id,
            grade: m.class_label,
            section: '',
        }))), [])

    async function submit() {
        if (!code.trim() || !borrower) return
        setBusy(true)
        try {
            const loan = await issueLoan({ copy_code: code.trim(), borrower: borrower.id })
            setCode('')
            setBorrower(null)
            onIssued?.()
            toast.success(t('library.circulation.issued', {
                title: loan.book_title, due: formatDate(loan.due_on),
            }))
        } catch (e) {
            // The server explains WHICH rule stopped it — at their limit, or an
            // overdue book — so the message is passed through rather than
            // replaced with a generic failure.
            toast.error(errorMessage(e, t('library.circulation.issueFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <ListSection icon="output" title={t('library.circulation.issueTitle')}>
            <div className="lib-issue-row">
                <div className="lib-issue-field">
                    <label className="form-label" htmlFor="issue-code">
                        {t('library.circulation.scanCode')}
                    </label>
                    <input
                        id="issue-code"
                        className="form-input"
                        value={code}
                        autoFocus
                        placeholder={t('library.circulation.scanPlaceholder')}
                        onChange={e => setCode(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && borrower) submit() }}
                    />
                </div>
                <div className="lib-issue-field">
                    <StudentSearchPicker
                        value={borrower}
                        onChange={setBorrower}
                        fetchStudents={searchMembers}
                        label={t('library.fields.borrower')}
                        placeholder={t('library.circulation.findBorrower')}
                    />
                </div>
                <button className="btn btn-primary" onClick={submit}
                    disabled={busy || !code.trim() || !borrower}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">check</span>
                    {t('library.circulation.issue')}
                </button>
            </div>
        </ListSection>
    )
}

function LoanRow({ loan, onReturn, onRenew }) {
    const { t } = useTranslation()
    const late = loan.status === 'overdue'

    return (
        <li className={`lib-loan-row${late ? ' overdue' : ''}`}>
            <span className={`lib-loan-icon${late ? ' overdue' : ''}`} aria-hidden="true">
                <span className="material-symbols-rounded">{late ? 'running_with_errors' : 'book'}</span>
            </span>
            <div className="lib-loan-main">
                <div className="u-strong u-sm">{loan.book_title}</div>
                <div className="text-xs-muted">
                    {loan.borrower_detail?.name}
                    {loan.borrower_detail?.class_label ? ` · ${loan.borrower_detail.class_label}` : ''}
                    {' · '}<code>{loan.copy_code}</code>
                </div>
            </div>
            <div className="lib-loan-due">
                <span className={late ? 'lib-stock-none' : 'text-xs-muted'}>
                    {late
                        ? t('library.circulation.daysLate', { count: loan.days_late })
                        : t('library.circulation.dueOn', { date: formatDate(loan.due_on) })}
                </span>
            </div>
            {loan.status !== 'returned' && (
                <div className="lib-loan-actions">
                    <button className="btn btn-outline btn-sm" onClick={onRenew}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">update</span>
                        {t('library.circulation.renew')}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={onReturn}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">assignment_return</span>
                        {t('library.circulation.return')}
                    </button>
                </div>
            )}
        </li>
    )
}
