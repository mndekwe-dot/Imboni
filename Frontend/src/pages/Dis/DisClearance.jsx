import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { SearchBar } from '../../components/ui/SearchBar'
import { SkeletonList } from '../../components/ui/Skeleton'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getClearance, getClearanceDetail } from '../../api/discipline'
import { disNavItems, disSecondaryItems } from './disNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import '../../styles/tables.css'

const PAGE_SIZE = 10

/**
 * Who in a class is free to leave.
 *
 * At the end of term a boarder has to have paid, returned their library books,
 * be out of the sick bay and have no medicine still held for them. Those answers
 * live in four portals, so the person at the gate had to ask four offices. This
 * puts them in one row per student, with the reason when the answer is no.
 */
export function DisClearance() {
    const { t } = useTranslation()
    const toast = useToast()
    const sessionUser = useSessionUser()
    const { setting } = useSchoolSettings()
    const { notifications, markRead } = useNotifications()

    const [rows, setRows] = useState([])
    const [total, setTotal] = useState(0)
    const [summary, setSummary] = useState(null)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [section, setSection] = useState('')
    const [year, setYear] = useState('')
    const [classVal, setClassVal] = useState('')
    const [open, setOpen] = useState(null)

    const query = useDebouncedValue(search.trim(), 300)
    const currency = setting?.currency || 'RWF'
    const money = n => `${new Intl.NumberFormat().format(n)} ${currency}`

    useEffect(() => {
        let alive = true
        setLoading(true)
        getClearance({
            page, page_size: PAGE_SIZE,
            grade: year || undefined, section: classVal || undefined, search: query || undefined,
        }).then(res => {
            if (!alive) return
            setRows(res?.results ?? [])
            setTotal(res?.count ?? 0)
            setSummary(res?.summary ?? null)
        }).catch(err => {
            if (alive) toast.error(errorMessage(err, t('dis.clearance.loadFailed')))
        }).finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [page, year, classVal, query, toast, t])

    useEffect(() => { setPage(1) }, [year, classVal, query])

    const tiles = [
        { icon: 'verified_user', value: summary?.cleared ?? '-', label: t('dis.clearance.cleared'), colorClass: 'success' },
        { icon: 'block', value: summary?.blocked ?? '-', label: t('dis.clearance.blocked'), colorClass: 'warning' },
    ]

    // Fees, library and medical each show a tick, or the one fact that blocks.
    const ok = <span className="clr-ok"><span className="material-symbols-rounded" aria-hidden="true">check_circle</span><span className="sr-only">{t('dis.clearance.ok')}</span></span>
    const why = text => <span className="clr-no"><span className="material-symbols-rounded" aria-hidden="true">error</span>{text}</span>

    const feesCell = r => r.finance.cleared ? ok : why(t('dis.clearance.owes', { amount: money(r.finance.owed) }))
    const libraryCell = r => r.library.cleared ? ok : why(
        r.library.books_out
            ? t('dis.clearance.booksOut', { count: r.library.books_out })
            : t('dis.clearance.fineOwed', { amount: money(r.library.owed) }))
    const medicalCell = r => r.medical.cleared ? ok : why(
        r.medical.in_sick_bay ? t('dis.clearance.inSickBay') : t('dis.clearance.medicineHeld'))

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title={t('dis.clearance.title')} subtitle={t('dis.clearance.subtitle')}
                        {...sessionUser} notifications={notifications} onNotificationRead={markRead} />
                    <DashboardContent>
                        <div className="portal-stat-grid">
                            {tiles.map((s, i) => <StatCard key={i} {...s} loading={loading && !summary} />)}
                        </div>

                        <ClassPicker
                            section={section} onSectionChange={s => { setSection(s); setYear(''); setClassVal('') }}
                            year={year} onYearChange={y => { setYear(y); setClassVal('') }}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        <div className="toolbar-card">
                            <SearchBar value={search} onChange={setSearch} placeholder={t('common.searchStudents')} />
                        </div>

                        <DataTable
                            title={t('dis.clearance.table')}
                            data={rows} total={total} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
                            loading={loading} loadingLabel={t('dis.clearance.loading')} skeletonAvatar
                            columns={[
                                t('common.student'), t('common.class'), t('dis.clearance.fees'),
                                t('dis.clearance.library'), t('dis.clearance.medical'), t('common.status'), t('common.actions'),
                            ]}
                            renderRow={r => (
                                <tr key={r.student_id}>
                                    <td>
                                        <div className="u-strong">{r.full_name}</div>
                                        <div className="text-muted">{r.student_code}</div>
                                    </td>
                                    <td>{r.grade_label}{r.section}</td>
                                    <td>{feesCell(r)}</td>
                                    <td>{libraryCell(r)}</td>
                                    <td>{medicalCell(r)}</td>
                                    <td>
                                        <span className={`badge ${r.cleared ? 'badge-soft-success' : 'badge-soft-warning'}`}>
                                            {r.cleared ? t('dis.clearance.canLeave') : t('dis.clearance.notYet')}
                                        </span>
                                        {r.away && <span className="badge badge-soft-info">{t('dis.clearance.away')}</span>}
                                    </td>
                                    <td>
                                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(r)}>
                                            {t('common.view')}
                                        </button>
                                    </td>
                                </tr>
                            )}
                            emptyIcon="verified_user"
                            emptyTitle={t('dis.clearance.emptyTitle')}
                            emptyDesc={t('dis.clearance.emptyDesc')}
                            onClearFilters={() => { setSearch(''); setSection(''); setYear(''); setClassVal('') }}
                        />
                    </DashboardContent>
                </main>
            </div>
            {open && <ClearanceDetail row={open} money={money} onClose={() => setOpen(null)} />}
        </>
    )
}

/** One student's card: the verdict, and what to pay or bring back. */
function ClearanceDetail({ row, money, onClose }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [detail, setDetail] = useState(null)

    useEffect(() => {
        let alive = true
        getClearanceDetail(row.student_id)
            .then(d => { if (alive) setDetail(d) })
            .catch(err => { if (alive) toast.error(errorMessage(err, t('dis.clearance.loadFailed'))) })
        return () => { alive = false }
    }, [row.student_id, toast, t])

    const d = detail || row
    const section = (icon, title, cleared, body) => (
        <section className={`clr-section ${cleared ? 'is-ok' : 'is-blocked'}`}>
            <h3 className="clr-section-title">
                <span className="material-symbols-rounded" aria-hidden="true">{cleared ? 'check_circle' : 'error'}</span>
                {title}
            </h3>
            <div className="clr-section-body">{body}</div>
        </section>
    )

    return (
        <Modal title={row.full_name} icon="verified_user" onClose={onClose}
            footer={<button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>}>
            <p className={`clr-verdict ${d.cleared ? 'is-ok' : 'is-blocked'}`}>
                {d.cleared ? t('dis.clearance.canLeaveDetail') : t('dis.clearance.notYetDetail')}
            </p>

            {section('payments', t('dis.clearance.fees'), d.finance.cleared,
                d.finance.cleared ? t('dis.clearance.nothingOwed')
                    : t('dis.clearance.owes', { amount: money(d.finance.owed) }))}

            {section('local_library', t('dis.clearance.library'), d.library.cleared, (
                d.library.cleared ? t('dis.clearance.nothingOwed') : (
                    <>
                        {!detail && d.library.books_out > 0 && <SkeletonList items={Math.min(d.library.books_out, 3)} avatar={false} flush />}
                        {detail?.library.books?.length > 0 && (
                            <ul className="clr-list">
                                {detail.library.books.map(b => (
                                    <li key={b.copy_code}>
                                        {b.title} <span className="text-muted">({b.copy_code})</span>
                                        {b.overdue && <span className="badge badge-soft-warning">{t('dis.clearance.overdue')}</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {d.library.owed > 0 && <p>{t('dis.clearance.fineOwed', { amount: money(d.library.owed) })}</p>}
                    </>
                )
            ))}

            {section('medication', t('dis.clearance.medical'), d.medical.cleared, (
                d.medical.cleared ? t('dis.clearance.nothingHeld') : (
                    <>
                        {d.medical.in_sick_bay && <p>{t('dis.clearance.inSickBay')}</p>}
                        {d.medical.medication?.length > 0 && (
                            <p>{t('dis.clearance.medicineHeldList', { list: d.medical.medication.join(', ') })}</p>
                        )}
                    </>
                )
            ))}
        </Modal>
    )
}
