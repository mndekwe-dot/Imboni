import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import {
    createFeeStructure, deleteFeeStructure, getFeeStructures, invoiceStructure,
} from '../../api/finance'
import { FinanceShell, Money } from './FinanceShell'

const CATEGORIES = ['tuition', 'transport', 'lunch', 'uniform', 'activity', 'other']

/**
 * What each year group is charged this term, and the button that raises it.
 *
 * The point of a structure is bulk. Setting "S4 pays 85,000 tuition" once and
 * invoicing from it is what stops one child being charged last term's amount —
 * the kind of error nobody finds until a parent does.
 */
export function FinanceStructure() {
    const { t } = useTranslation()
    const toast = useToast()

    const [rows, setRows]       = useState([])
    const [loading, setLoading] = useState(true)
    const [showNew, setShowNew] = useState(false)
    const [busyId, setBusyId]   = useState(null)

    const load = useCallback(() => {
        setLoading(true)
        getFeeStructures()
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    async function handleCreate(form) {
        try {
            await createFeeStructure(form)
            setShowNew(false)
            load()
            toast.success(t('finance.structure.added'))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        }
    }

    async function handleInvoice(row) {
        setBusyId(row.id)
        try {
            const result = await invoiceStructure(row.id)
            // Idempotent on the server, so "0 raised" means everybody already
            // has this charge -- which is worth saying rather than looking
            // like nothing happened.
            toast.success(result.created
                ? t('finance.structure.invoiced', { count: result.created })
                : t('finance.structure.alreadyInvoiced'))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        } finally {
            setBusyId(null)
        }
    }

    async function handleDelete(row) {
        try {
            await deleteFeeStructure(row.id)
            load()
            toast.success(t('common.deleted'))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        }
    }

    return (
        <FinanceShell title={t('finance.structure.title')} subtitle={t('finance.structure.subtitle')}>
            {showNew && <StructureForm onClose={() => setShowNew(false)} onSave={handleCreate} />}

            <div className="toolbar-card mb-1-5">
                <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('finance.structure.add')}
                </button>
            </div>

            <ListSection
                icon="price_change"
                title={t('finance.structure.title')}
                count={loading ? null : t('finance.structureCount', { count: rows.length })}
            >
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon="price_change"
                        title={t('finance.structure.empty')}
                        description={t('finance.structure.emptyDesc')}
                        action={{ label: t('finance.structure.add'), icon: 'add',
                            onClick: () => setShowNew(true) }}
                    />
                ) : (
                    <ul className="row-list">
                        {rows.map(row => (
                            <li key={row.id} className="row-item">
                                <span className="class-chip">{row.class_label}</span>
                                <div className="row-main">
                                    <div className="u-strong u-sm">
                                        {t(`finance.categories.${row.category}`)}
                                    </div>
                                    <div className="text-xs-muted">
                                        {t('finance.structure.dueBy', { date: formatDate(row.due_date) })}
                                        {row.term_name ? ` · ${row.term_name}` : ''}
                                    </div>
                                </div>
                                <Money value={row.amount} />
                                <div className="row-actions">
                                    <button className="btn btn-outline btn-sm"
                                        onClick={() => handleDelete(row)}>
                                        {t('common.delete')}
                                    </button>
                                    <button className="btn btn-primary btn-sm"
                                        disabled={busyId === row.id}
                                        onClick={() => handleInvoice(row)}>
                                        <span className="material-symbols-rounded icon-sm"
                                            aria-hidden="true">receipt_long</span>
                                        {t('finance.structure.invoice')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ListSection>
        </FinanceShell>
    )
}

function StructureForm({ onClose, onSave }) {
    const { t } = useTranslation()
    const [section, setSection] = useState('')
    const [year, setYear]       = useState('')
    const [stream, setStream]   = useState('')
    const [form, setForm] = useState({ category: 'tuition', amount: '', due_date: '', notes: '' })
    const [error, setError] = useState(null)

    function submit() {
        if (!year || !form.amount || !form.due_date) {
            setError(t('finance.structure.required'))
            return
        }
        onSave({ ...form, grade: year, section: stream || '' })
    }

    return (
        <Modal
            title={t('finance.structure.add')}
            icon="price_change"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={submit}>{t('common.save')}</button>
                </>
            }
        >
            {/* Reads the school's own structure — no `sections` prop, so it
                cannot offer a year the school does not teach. */}
            <ClassPicker
                section={section} onSectionChange={setSection}
                year={year} onYearChange={setYear}
                classVal={stream} onClassChange={setStream}
            />

            <div className="form-grid mt-1-5">
                <div>
                    <label className="form-label" htmlFor="st-category">
                        {t('finance.fields.category')}
                    </label>
                    <select id="st-category" className="form-select" value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                        {CATEGORIES.map(c => (
                            <option key={c} value={c}>{t(`finance.categories.${c}`)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label" htmlFor="st-amount">
                        {t('finance.fields.amount')}
                    </label>
                    <input id="st-amount" type="number" step="0.01" className="form-input"
                        value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                    <label className="form-label" htmlFor="st-due">{t('finance.fields.due')}</label>
                    <input id="st-due" type="date" className="form-input" value={form.due_date}
                        onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="form-col-full">
                    <label className="form-label" htmlFor="st-notes">{t('common.notes')}</label>
                    <input id="st-notes" className="form-input" value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
            </div>
            {error && <p className="form-error">{error}</p>}
        </Modal>
    )
}
