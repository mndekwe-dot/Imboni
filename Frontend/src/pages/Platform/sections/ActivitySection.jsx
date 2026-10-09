import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAuditLog } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SkeletonList } from '../../../components/ui/Skeleton'

// The verbs worth filtering by, in the order an operator would look for them.
const FILTERS = ['', 'school', 'application', 'contract', 'payment', 'ticket', 'operator']

function describeChanges(changes) {
    if (!changes || !Object.keys(changes).length) return ''
    return Object.entries(changes)
        .map(([field, value]) => (Array.isArray(value)
            ? `${field}: ${value[0]} → ${value[1]}`
            : `${field}: ${value}`))
        .join(' · ')
}

/**
 * Who did what, above the schools.
 *
 * Read-only, and open to every operator including support: an audit trail only
 * the powerful can inspect is not accountability. Entries with no actor were
 * written by the nightly job rather than a person, and say so.
 */
export function ActivitySection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [entries, setEntries] = useState([])
    const [filter, setFilter] = useState('')
    const [loading, setLoading] = useState(true)

    const load = useCallback(async (action) => {
        setLoading(true)
        try {
            setEntries(await getAuditLog(action ? { action } : null))
        } catch (e) {
            toast.error(errorMessage(e, t('platform.activity.loadFailed')))
        } finally {
            setLoading(false)
        }
    }, [toast, t])

    useEffect(() => { load(filter) }, [load, filter])

    // A verb reads better than a dotted key in a table an operator scans. An
    // action nobody has written a sentence for yet shows its own key.
    const describe = action => t(`platform.activity.actions.${action}`, { defaultValue: action })

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>{t('platform.activity.title')}</h2>
                    <span className="platform-muted">{t('platform.activity.recent', { count: entries.length })}</span>
                </div>

                <div className="filter-tabs-bar filter-tabs-bar--spaced">
                    {FILTERS.map(key => (
                        <button key={key || 'all'}
                                className={`filter-tab ${filter === key ? 'active' : ''}`}
                                onClick={() => setFilter(key)}>
                            {t(`platform.activity.filters.${key || 'all'}`)}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <SkeletonList items={3} />
                ) : entries.length === 0 ? (
                    <p className="platform-muted">{t('platform.activity.empty')}</p>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('platform.activity.cols.when')}</th><th>{t('platform.activity.cols.who')}</th>
                                    <th>{t('platform.activity.cols.what')}</th><th>{t('platform.activity.cols.school')}</th>
                                    <th>{t('platform.activity.cols.detail')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr key={entry.id}>
                                        <td>{new Date(entry.created_at).toLocaleString()}</td>
                                        <td>
                                            {entry.actor_email
                                                ? <span className="platform-strong">{entry.actor_email}</span>
                                                : <span className="platform-muted">{t('platform.activity.automatic')}</span>}
                                            {entry.actor_role && (
                                                <span className="platform-chip platform-chip-info pf-ml">
                                                    {entry.actor_role}
                                                </span>
                                            )}
                                        </td>
                                        <td>{describe(entry.action)}</td>
                                        <td>{entry.school_name || entry.target_label || '-'}</td>
                                        <td className="platform-muted">{describeChanges(entry.changes)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
