import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchBar } from '../../components/ui/SearchBar'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { getMember, getMembers } from '../../api/library'
import { LibraryShell } from './LibraryShell'

/**
 * Who may borrow, and what they have.
 *
 * There is no member table behind this — see the note at the top of the
 * backend's models.py. It is the school roster with the library's numbers
 * attached, which is why a student who leaves stops being a borrower without
 * anyone remembering to close a library account.
 */
export function LibraryMembers() {
    const { t } = useTranslation()
    const toast = useToast()

    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch]   = useState('')
    const [openId, setOpenId]   = useState(null)

    const load = useCallback(() => {
        setLoading(true)
        getMembers()
            .then(d => setMembers(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    const q = search.trim().toLowerCase()
    const visible = members.filter(m =>
        !q || (m.name || '').toLowerCase().includes(q)
        || (m.student_id || '').toLowerCase().includes(q)
        || (m.class_label || '').toLowerCase().includes(q))

    return (
        <LibraryShell title={t('library.members.title')} subtitle={t('library.members.subtitle')}>
            {openId && <MemberDetail id={openId} onClose={() => setOpenId(null)} />}

            <div className="toolbar-card mb-1-5">
                <SearchBar value={search} onChange={setSearch}
                    placeholder={t('library.members.searchPlaceholder')} />
            </div>

            <ListSection
                icon="people"
                title={t('library.members.title')}
                count={loading ? null : t('library.memberCount', { count: visible.length })}
            >
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon="search_off"
                        title={search ? t('common.noResults', { query: search }) : t('library.members.empty')}
                        description={search ? t('common.trySearch') : t('library.members.emptyDesc')}
                        action={search
                            ? { label: t('common.clear'), icon: 'close', onClick: () => setSearch('') }
                            : undefined}
                    />
                ) : (
                    <div className="lib-member-grid">
                        {visible.map(m => (
                            <button key={m.id} className="lib-member-card" onClick={() => setOpenId(m.id)}>
                                <span className="lib-member-avatar">{initials(m.name)}</span>
                                <span className="lib-member-body">
                                    <span className="u-strong u-sm">{m.name}</span>
                                    <span className="text-xs-muted">
                                        {m.class_label || t(`roles.${m.role}`)}
                                        {m.student_id ? ` · ${m.student_id}` : ''}
                                    </span>
                                </span>
                                <span className="lib-member-counts">
                                    <span className="badge">
                                        {t('library.members.outOfLimit', { out: m.on_loan, limit: m.limit })}
                                    </span>
                                    {m.overdue > 0 && (
                                        <span className="badge badge-high">
                                            {t('library.members.overdueCount', { count: m.overdue })}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </ListSection>
        </LibraryShell>
    )
}

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function MemberDetail({ id, onClose }) {
    const { t } = useTranslation()
    const [data, setData] = useState(null)

    useEffect(() => {
        getMember(id).then(setData).catch(() => setData(null))
    }, [id])

    return (
        <Modal
            title={data?.member?.name || t('common.loading')}
            icon="person"
            size="wide"
            onClose={onClose}
            footer={<button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>}
        >
            {!data ? <p className="u-muted">{t('common.loading')}</p> : (
                <>
                    {/* Why they cannot borrow, in the words the server used —
                        "at their limit" and "has an overdue book" need
                        different answers at the desk. */}
                    {data.blocked_reason && (
                        <div className="alert alert-warning u-mb">
                            <span className="material-symbols-rounded alert-icon" aria-hidden="true">block</span>
                            {data.blocked_reason}
                        </div>
                    )}

                    <dl className="lib-detail-grid">
                        <div><dt>{t('library.fields.role')}</dt><dd>{t(`roles.${data.member.role}`)}</dd></div>
                        <div><dt>{t('common.class')}</dt><dd>{data.member.class_label || '-'}</dd></div>
                        <div><dt>{t('common.admNo')}</dt><dd>{data.member.student_id || '-'}</dd></div>
                        <div><dt>{t('library.members.limit')}</dt><dd>{data.limit}</dd></div>
                    </dl>

                    <DataTable
                        title={t('library.members.history')}
                        data={data.loans}
                        pageSize={6}
                        columns={[t('library.fields.title'), t('library.fields.issued'),
                            t('library.fields.due'), t('common.status')]}
                        emptyIcon="menu_book"
                        emptyTitle={t('library.members.noLoans')}
                        emptyDesc={t('library.members.noLoansDesc')}
                        renderRow={loan => (
                            <tr key={loan.id}>
                                <td><strong>{loan.book_title}</strong></td>
                                <td className="text-muted">{formatDate(loan.issued_at)}</td>
                                <td className="text-muted">{formatDate(loan.due_on)}</td>
                                <td>
                                    <span className={`badge lib-loan-${loan.status}`}>
                                        {t(`library.loanStatus.${loan.status}`)}
                                    </span>
                                </td>
                            </tr>
                        )}
                    />

                    {data.outstanding_fines?.length > 0 && (
                        <p className="lib-fine-note">
                            {t('library.members.owes', {
                                amount: data.outstanding_fines
                                    .reduce((sum, f) => sum + Number(f.amount), 0)
                                    .toFixed(2),
                            })}
                        </p>
                    )}
                </>
            )}
        </Modal>
    )
}
