import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { ClassMultiPicker } from '../../components/ui/ClassMultiPicker'
import { StudentMultiPicker } from '../../components/ui/StudentMultiPicker'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import {
    copyStructures, createFeeCategory, createFeeDiscount, createFeeStructure,
    deleteFeeCategory, deleteFeeDiscount, deleteFeeStructure, getFeeCategories,
    getFeeDiscounts, getFeeStructures, getTerms, invoiceStructure, invoiceTerm,
    previewStructure, searchStudents, updateFeeCategory, updateFeeDiscount, updateFeeStructure,
} from '../../api/finance'
import { Money, categoryName, formatAmount } from './FinanceShell'

const BOARDING = ['all', 'boarders', 'day']
const INTAKE = ['all', 'new', 'returning']
const FREQUENCY = ['term', 'year', 'once']
const SCOPES = ['students', 'siblings', 'boarders', 'day', 'all']

const findStudents = q => searchStudents({ q }).then(rows => (Array.isArray(rows) ? rows : []))

/**
 * What the school charges, who pays it, and turning it into bills.
 *
 * A line is not "S4 tuition" any more. It names its classes (several years,
 * or particular streams), whether boarders or day students pay, whether new or
 * returning students pay, how often (every term, once a year, once ever),
 * whether it is optional, and whether it is paid in instalments. Discounts sit
 * beside the lines and are applied as bills are raised, with the reason written
 * on each charge. Nothing is billed until the office presses Invoice, and the
 * whole term can be previewed first.
 */
export function FeeSetupPanel() {
    const { t } = useTranslation()
    const toast = useToast()

    const [lines, setLines]         = useState([])
    const [categories, setCategories] = useState([])
    const [discounts, setDiscounts] = useState([])
    const [terms, setTerms]         = useState([])
    const [loading, setLoading]     = useState(true)
    const [editing, setEditing]     = useState(null)      // a line, or {} for a new one
    const [editingDiscount, setEditingDiscount] = useState(null)
    const [managing, setManaging]   = useState(false)
    const [preview, setPreview]     = useState(null)      // a line whose students to show
    const [termPreview, setTermPreview] = useState(null)
    const [busyId, setBusyId]       = useState(null)
    const [copyFrom, setCopyFrom]   = useState('')

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([getFeeStructures(), getFeeCategories(), getFeeDiscounts(), getTerms()])
            .then(([l, c, d, tm]) => {
                setLines(Array.isArray(l) ? l : [])
                setCategories(Array.isArray(c) ? c : [])
                setDiscounts(Array.isArray(d) ? d : [])
                setTerms(Array.isArray(tm) ? tm : [])
            })
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    const current = terms.find(term => term.is_current)
    const otherTerms = terms.filter(term => !term.is_current)
    const activeCategories = categories.filter(c => c.is_active)

    async function act(id, action, success) {
        setBusyId(id)
        try {
            const result = await action()
            if (success) toast.success(typeof success === 'function' ? success(result) : success)
            load()
            return result
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
            return null
        } finally {
            setBusyId(null)
        }
    }

    const invoiceLine = line => act(line.id, () => invoiceStructure(line.id), result => (
        result.created
            ? t('finance.structure.invoiced', { count: result.students ?? result.created })
            : t('finance.structure.alreadyInvoiced')))

    async function openTermPreview() {
        const result = await act('term', () => invoiceTerm({ dry_run: true }))
        if (result) setTermPreview(result)
    }

    return (
        <>
            {editing && (
                <FeeLineModal line={editing} categories={activeCategories}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load() }} />
            )}
            {editingDiscount && (
                <DiscountModal discount={editingDiscount} categories={activeCategories}
                    onClose={() => setEditingDiscount(null)}
                    onSaved={() => { setEditingDiscount(null); load() }} />
            )}
            {managing && (
                <CategoriesModal categories={categories} onClose={() => setManaging(false)} onChanged={load} />
            )}
            {preview && <LinePreviewModal line={preview} onClose={() => setPreview(null)} />}
            {termPreview && (
                <TermInvoiceModal preview={termPreview} termName={current?.name}
                    onClose={() => setTermPreview(null)}
                    onDone={() => { setTermPreview(null); load() }} />
            )}

            <div className="toolbar-card mb-1-5">
                <button className="btn btn-primary" onClick={() => setEditing({})}
                    disabled={!activeCategories.length}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('finance.structure.add')}
                </button>
                <button className="btn btn-outline" onClick={openTermPreview}
                    disabled={loading || busyId === 'term' || !lines.some(l => l.is_active)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">receipt_long</span>
                    {t('finance.structure.invoiceTerm')}
                </button>
                <div className="toolbar-spacer" />
                {otherTerms.length > 0 && (
                    <div className="fin-copy-term">
                        <select className="form-input class-filter-select" value={copyFrom}
                            aria-label={t('finance.structure.copyFrom')}
                            onChange={e => setCopyFrom(e.target.value)}>
                            <option value="">{t('finance.structure.copyFrom')}</option>
                            {otherTerms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
                        </select>
                        <button className="btn btn-outline btn-sm" disabled={!copyFrom || busyId === 'copy'}
                            onClick={() => act('copy', () => copyStructures(copyFrom),
                                result => t('finance.structure.copied', { count: result.copied }))}>
                            {t('finance.structure.copy')}
                        </button>
                    </div>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setManaging(true)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">category</span>
                    {t('finance.structure.categories')}
                </button>
            </div>

            <ListSection icon="price_change" className="mb-1-5"
                title={current ? t('finance.structure.linesFor', { term: current.name }) : t('finance.structure.title')}
                count={loading ? null : t('finance.structureCount', { count: lines.length })}>
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : lines.length === 0 ? (
                    <EmptyState icon="price_change" title={t('finance.structure.empty')}
                        description={t('finance.structure.emptyDesc')}
                        action={{ label: t('finance.structure.add'), icon: 'add', onClick: () => setEditing({}) }} />
                ) : (
                    <ul className="row-list">
                        {lines.map(line => (
                            <li key={line.id} className={`row-item${line.is_active ? '' : ' fin-line-off'}`}>
                                <div className="row-main">
                                    <div className="u-strong u-sm">
                                        {line.name || categoryName(t, line.category, line.category_name)}
                                        {line.name && <span className="text-xs-muted"> · {categoryName(t, line.category, line.category_name)}</span>}
                                    </div>
                                    <div className="fin-line-tags">
                                        <span className="class-chip">
                                            {line.classes.length ? line.class_label : t('finance.structure.wholeSchool')}
                                        </span>
                                        {line.boarding !== 'all' && <span className="badge">{t(`finance.structure.boarding.${line.boarding}`)}</span>}
                                        {line.intake !== 'all' && <span className="badge">{t(`finance.structure.intake.${line.intake}`)}</span>}
                                        {line.frequency !== 'term' && <span className="badge">{t(`finance.structure.frequency.${line.frequency}`)}</span>}
                                        {!line.is_mandatory && <span className="badge">{t('finance.structure.optionalTag', { count: line.student_list.length })}</span>}
                                        {line.instalments.length > 0 && <span className="badge">{t('finance.structure.instalmentsTag', { count: line.instalments.length })}</span>}
                                        {!line.is_active && <span className="badge">{t('finance.structure.offTag')}</span>}
                                    </div>
                                    <div className="text-xs-muted">
                                        {line.instalments.length
                                            ? line.instalments.map(step => `${step.percent}% ${formatDate(step.due_date)}`).join(' · ')
                                            : t('finance.structure.dueBy', { date: formatDate(line.due_date) })}
                                        {' · '}{t('finance.structure.billedCount', { count: line.charged })}
                                    </div>
                                </div>
                                <Money value={line.amount} />
                                <div className="row-actions">
                                    <button className="btn btn-ghost btn-sm" onClick={() => setPreview(line)}>
                                        {t('finance.structure.whoPays')}
                                    </button>
                                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(line)}>
                                        {t('common.edit')}
                                    </button>
                                    {line.charged === 0 ? (
                                        <button className="btn btn-outline btn-sm" disabled={busyId === line.id}
                                            onClick={() => act(line.id, () => deleteFeeStructure(line.id), t('common.deleted'))}>
                                            {t('common.delete')}
                                        </button>
                                    ) : (
                                        <button className="btn btn-outline btn-sm" disabled={busyId === line.id}
                                            onClick={() => act(line.id, () => updateFeeStructure(line.id, { is_active: !line.is_active }),
                                                t('common.saved'))}>
                                            {line.is_active ? t('finance.structure.switchOff') : t('finance.structure.switchOn')}
                                        </button>
                                    )}
                                    <button className="btn btn-primary btn-sm"
                                        disabled={busyId === line.id || !line.is_active}
                                        onClick={() => invoiceLine(line)}>
                                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">receipt_long</span>
                                        {t('finance.structure.invoice')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ListSection>

            <ListSection icon="sell" title={t('finance.discounts.title')}
                count={loading ? null : discounts.length}
                headerRight={(
                    <button className="btn btn-outline btn-sm" onClick={() => setEditingDiscount({})}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                        {t('finance.discounts.add')}
                    </button>
                )}>
                <p className="text-xs-muted mb-1">{t('finance.discounts.intro')}</p>
                {!loading && discounts.length === 0 ? (
                    <EmptyState icon="sell" title={t('finance.discounts.none')}
                        description={t('finance.discounts.noneDesc')} />
                ) : (
                    <ul className="row-list">
                        {discounts.map(discount => (
                            <li key={discount.id} className={`row-item${discount.is_active ? '' : ' fin-line-off'}`}>
                                <div className="row-main">
                                    <div className="u-strong u-sm">{discount.name}</div>
                                    <div className="text-xs-muted">
                                        {t(`finance.discounts.scope.${discount.scope}`, { count: discount.student_list.length, child: discount.from_child })}
                                        {' · '}
                                        {discount.categories.length
                                            ? discount.categories.map(code => categoryName(t, code, categories.find(c => c.code === code)?.name)).join(', ')
                                            : t('finance.discounts.allCategories')}
                                        {' · '}{discount.term_name || t('finance.discounts.everyTerm')}
                                    </div>
                                </div>
                                <span className="u-strong">
                                    {discount.kind === 'percent' ? `${Number(discount.value)}%` : <Money value={discount.value} />}
                                </span>
                                <div className="row-actions">
                                    <button className="btn btn-outline btn-sm" onClick={() => setEditingDiscount(discount)}>
                                        {t('common.edit')}
                                    </button>
                                    <button className="btn btn-outline btn-sm" disabled={busyId === discount.id}
                                        onClick={() => act(discount.id, () => deleteFeeDiscount(discount.id), t('common.deleted'))}>
                                        {t('common.delete')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ListSection>
        </>
    )
}

function Choice({ id, label, value, options, onChange, labelFor }) {
    return (
        <div>
            <label className="form-label" htmlFor={id}>{label}</label>
            <select id={id} className="form-select" value={value} onChange={e => onChange(e.target.value)}>
                {options.map(option => <option key={option} value={option}>{labelFor(option)}</option>)}
            </select>
        </div>
    )
}

/** One fee line: what, how much, who pays, how often, in how many parts. */
function FeeLineModal({ line, categories, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const isNew = !line.id
    const [form, setForm] = useState({
        name: line.name || '',
        category: line.category || categories[0]?.code || '',
        amount: line.amount ? String(Number(line.amount)) : '',
        due_date: line.due_date || '',
        classes: line.classes || [],
        boarding: line.boarding || 'all',
        intake: line.intake || 'all',
        frequency: line.frequency || 'term',
        is_mandatory: line.is_mandatory ?? true,
        instalments: (line.instalments || []).map(step => ({ ...step, percent: String(step.percent) })),
        notes: line.notes || '',
    })
    const [students, setStudents] = useState(line.student_list || [])
    const [busy, setBusy] = useState(false)
    const set = key => value => setForm(f => ({ ...f, [key]: value }))

    const percentTotal = form.instalments.reduce((sum, step) => sum + (Number(step.percent) || 0), 0)
    const planOk = form.instalments.length === 0
        || (form.instalments.length >= 2 && Math.abs(percentTotal - 100) < 0.001
            && form.instalments.every(step => step.due_date))
    const canSave = form.category && Number(form.amount) > 0
        && (form.instalments.length ? planOk : form.due_date)
        && (form.is_mandatory || students.length > 0)

    function setInstalment(index, key, value) {
        setForm(f => ({ ...f, instalments: f.instalments.map((step, i) => (i === index ? { ...step, [key]: value } : step)) }))
    }

    function splitEvenly(count) {
        const base = Math.floor(100 / count)
        setForm(f => ({
            ...f,
            instalments: Array.from({ length: count }, (_, i) => ({
                percent: String(i === count - 1 ? 100 - base * (count - 1) : base),
                due_date: f.instalments[i]?.due_date || (i === 0 ? f.due_date : ''),
            })),
        }))
    }

    async function save() {
        setBusy(true)
        const payload = {
            ...form,
            amount: String(form.amount),
            // With instalments the first part's date is the line's due date.
            due_date: form.instalments.length ? form.instalments[0].due_date : form.due_date,
            instalments: form.instalments.map(step => ({ percent: Number(step.percent), due_date: step.due_date })),
            students: students.map(s => s.id),
        }
        try {
            if (isNew) await createFeeStructure(payload)
            else await updateFeeStructure(line.id, payload)
            toast.success(t(isNew ? 'finance.structure.added' : 'common.saved'))
            onSaved()
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title={t(isNew ? 'finance.structure.add' : 'finance.structure.edit')} icon="price_change"
            size="wide" onClose={onClose}
            footer={(
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={save} disabled={busy || !canSave}>
                        {busy ? t('common.saving') : t('common.save')}
                    </button>
                </>
            )}>
            {line.charged > 0 && <p className="alert alert-info mb-1">{t('finance.structure.editBilledNote')}</p>}
            <div className="form-grid">
                <div>
                    <label className="form-label" htmlFor="fl-name">{t('finance.structure.name')}</label>
                    <input id="fl-name" className="form-input" value={form.name}
                        placeholder={t('finance.structure.namePlaceholder')}
                        onChange={e => set('name')(e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="fl-category">{t('finance.fields.category')}</label>
                    <select id="fl-category" className="form-select" value={form.category}
                        onChange={e => set('category')(e.target.value)}>
                        {categories.map(c => <option key={c.code} value={c.code}>{categoryName(t, c.code, c.name)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="form-label" htmlFor="fl-amount">{t('finance.fields.amount')}</label>
                    <input id="fl-amount" type="number" min="0" step="1" className="form-input" value={form.amount}
                        onChange={e => set('amount')(e.target.value)} />
                </div>
                {form.instalments.length === 0 && (
                    <div>
                        <label className="form-label" htmlFor="fl-due">{t('finance.fields.due')}</label>
                        <input id="fl-due" type="date" className="form-input" value={form.due_date}
                            onChange={e => set('due_date')(e.target.value)} />
                    </div>
                )}
            </div>

            <h3 className="fin-form-heading">{t('finance.structure.whoPays')}</h3>
            <ClassMultiPicker value={form.classes} onChange={set('classes')} idPrefix="fl-classes"
                allLabel={t('finance.structure.wholeSchool')} />
            <div className="form-grid mt-1">
                <Choice id="fl-boarding" label={t('finance.structure.boardingLabel')} value={form.boarding}
                    options={BOARDING} onChange={set('boarding')}
                    labelFor={key => t(`finance.structure.boarding.${key}`)} />
                <Choice id="fl-intake" label={t('finance.structure.intakeLabel')} value={form.intake}
                    options={INTAKE} onChange={set('intake')}
                    labelFor={key => t(`finance.structure.intake.${key}`)} />
                <Choice id="fl-frequency" label={t('finance.structure.frequencyLabel')} value={form.frequency}
                    options={FREQUENCY} onChange={set('frequency')}
                    labelFor={key => t(`finance.structure.frequency.${key}`)} />
            </div>
            <label className="form-check mt-1">
                <input type="checkbox" checked={!form.is_mandatory}
                    onChange={e => set('is_mandatory')(!e.target.checked)} />
                <span>{t('finance.structure.optional')}</span>
            </label>
            <p className="text-xs-muted">
                {t(form.is_mandatory ? 'finance.structure.studentsNarrowHint' : 'finance.structure.optionalHint')}
            </p>
            <StudentMultiPicker value={students} onChange={setStudents} fetchStudents={findStudents}
                label={t('finance.structure.students')} placeholder={t('finance.structure.findStudent')} />

            <h3 className="fin-form-heading">{t('finance.structure.instalments')}</h3>
            <div className="fin-split-choice">
                {[1, 2, 3].map(count => (
                    <button key={count} type="button"
                        className={`class-picker-chip${(form.instalments.length || 1) === count ? ' active' : ''}`}
                        onClick={() => (count === 1 ? set('instalments')([]) : splitEvenly(count))}>
                        {count === 1 ? t('finance.structure.payAtOnce') : t('finance.structure.parts', { count })}
                    </button>
                ))}
            </div>
            {form.instalments.length > 0 && (
                <div className="data-table-wrap framed mt-1">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('finance.structure.part')}</th>
                                <th>{t('finance.structure.percent')}</th>
                                <th>{t('finance.fields.due')}</th>
                                <th className="u-text-right">{t('finance.fields.amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {form.instalments.map((step, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>
                                        <input type="number" min="1" max="100" step="1" className="form-input fin-split-input"
                                            aria-label={t('finance.structure.percent')} value={step.percent}
                                            onChange={e => setInstalment(index, 'percent', e.target.value)} />
                                    </td>
                                    <td>
                                        <input type="date" className="form-input" aria-label={t('finance.fields.due')}
                                            value={step.due_date} onChange={e => setInstalment(index, 'due_date', e.target.value)} />
                                    </td>
                                    <td className="u-text-right">
                                        {formatAmount((Number(form.amount) || 0) * (Number(step.percent) || 0) / 100)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {!planOk && <p className="form-error">{t('finance.structure.partsMustAddUp', { total: percentTotal })}</p>}

            <div className="mt-1">
                <label className="form-label" htmlFor="fl-notes">{t('common.notes')}</label>
                <input id="fl-notes" className="form-input" value={form.notes}
                    onChange={e => set('notes')(e.target.value)} />
            </div>
        </Modal>
    )
}

/** Who a line would bill if invoiced now, and what each pays. */
function LinePreviewModal({ line, onClose }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData] = useState(null)

    useEffect(() => {
        previewStructure(line.id)
            .then(setData)
            .catch(e => {
                toast.error(errorMessage(e, t('finance.loadFailed')))
                setData({ students: [], total: '0', skipped: 0 })
            })
    }, [line.id, toast, t])

    return (
        <Modal title={line.name || categoryName(t, line.category, line.category_name)} icon="groups" size="wide" onClose={onClose}
            footer={<button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>}>
            {!data ? (
                <p className="u-muted">{t('common.loading')}</p>
            ) : (
                <>
                    <p className="u-sm mb-1">
                        {t('finance.structure.previewSummary', {
                            count: data.students.length, total: formatAmount(data.total), skipped: data.skipped,
                        })}
                    </p>
                    {data.students.length > 0 && (
                        <div className="data-table-wrap framed">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('common.student')}</th>
                                        <th>{t('finance.structure.why')}</th>
                                        <th className="u-text-right">{t('finance.fields.amount')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.students.map(row => (
                                        <tr key={row.student.id}>
                                            <td>
                                                <strong>{row.student.name}</strong>
                                                <span className="class-chip">{row.student.class_label}</span>
                                            </td>
                                            <td className="text-muted">{row.reasons.join(' · ') || '-'}</td>
                                            <td className="u-text-right"><Money value={row.amount} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </Modal>
    )
}

/** The whole term before any bill goes out: every line, how many, how much. */
function TermInvoiceModal({ preview, termName, onClose, onDone }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [busy, setBusy] = useState(false)

    async function confirm() {
        setBusy(true)
        try {
            const result = await invoiceTerm({})
            toast.success(t('finance.structure.termInvoiced', {
                count: result.students, total: formatAmount(result.total),
            }))
            onDone()
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title={t('finance.structure.invoiceTermTitle', { term: termName || '' })} icon="receipt_long"
            size="wide" onClose={onClose}
            footer={(
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={confirm} disabled={busy || Number(preview.total) <= 0}>
                        {t('finance.structure.invoiceTermConfirm', { total: formatAmount(preview.total) })}
                    </button>
                </>
            )}>
            <p className="u-sm mb-1">{t('finance.structure.invoiceTermIntro')}</p>
            <div className="data-table-wrap framed">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('finance.structure.line')}</th>
                            <th>{t('common.classes')}</th>
                            <th className="u-text-right">{t('finance.structure.toBill')}</th>
                            <th className="u-text-right">{t('finance.structure.alreadyBilled')}</th>
                            <th className="u-text-right">{t('finance.fields.amount')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {preview.lines.map(line => (
                            <tr key={line.id}>
                                <td><strong>{line.name}</strong></td>
                                <td>{line.class_label === 'All classes' ? t('finance.structure.wholeSchool') : line.class_label}</td>
                                <td className="u-text-right">{line.students}</td>
                                <td className="u-text-right">{line.skipped}</td>
                                <td className="u-text-right"><Money value={line.total} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    )
}

/** A standing discount, applied as charges are raised. */
function DiscountModal({ discount, categories, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const isNew = !discount.id
    const [form, setForm] = useState({
        name: discount.name || '',
        kind: discount.kind || 'percent',
        value: discount.value ? String(Number(discount.value)) : '',
        scope: discount.scope || 'students',
        from_child: discount.from_child || 2,
        categories: discount.categories || [],
        is_active: discount.is_active ?? true,
        notes: discount.notes || '',
    })
    const [students, setStudents] = useState(discount.student_list || [])
    const [busy, setBusy] = useState(false)
    const set = key => value => setForm(f => ({ ...f, [key]: value }))
    const canSave = form.name.trim() && Number(form.value) > 0
        && (form.kind !== 'percent' || Number(form.value) <= 100)
        && (form.scope !== 'students' || students.length > 0)

    function toggleCategory(code) {
        set('categories')(form.categories.includes(code)
            ? form.categories.filter(c => c !== code) : [...form.categories, code])
    }

    async function save() {
        setBusy(true)
        const payload = { ...form, value: String(form.value), from_child: Number(form.from_child) || 2,
            students: students.map(s => s.id) }
        try {
            if (isNew) await createFeeDiscount(payload)
            else await updateFeeDiscount(discount.id, payload)
            toast.success(t('common.saved'))
            onSaved()
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title={t(isNew ? 'finance.discounts.add' : 'finance.discounts.edit')} icon="sell"
            onClose={onClose}
            footer={(
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={save} disabled={busy || !canSave}>
                        {busy ? t('common.saving') : t('common.save')}
                    </button>
                </>
            )}>
            <p className="text-xs-muted mb-1">{t('finance.discounts.appliesFuture')}</p>
            <div className="form-grid">
                <div className="form-col-full">
                    <label className="form-label" htmlFor="fd-name">{t('finance.discounts.name')}</label>
                    <input id="fd-name" className="form-input" value={form.name}
                        placeholder={t('finance.discounts.namePlaceholder')}
                        onChange={e => set('name')(e.target.value)} />
                </div>
                <Choice id="fd-kind" label={t('finance.discounts.kindLabel')} value={form.kind}
                    options={['percent', 'fixed']} onChange={set('kind')}
                    labelFor={key => t(`finance.discounts.kind.${key}`)} />
                <div>
                    <label className="form-label" htmlFor="fd-value">
                        {form.kind === 'percent' ? t('finance.discounts.percent') : t('finance.fields.amount')}
                    </label>
                    <input id="fd-value" type="number" min="0" step="1" className="form-input" value={form.value}
                        onChange={e => set('value')(e.target.value)} />
                </div>
                <Choice id="fd-scope" label={t('finance.discounts.scopeLabel')} value={form.scope}
                    options={SCOPES} onChange={set('scope')}
                    labelFor={key => t(`finance.discounts.scopeOption.${key}`)} />
                {form.scope === 'siblings' && (
                    <div>
                        <label className="form-label" htmlFor="fd-child">{t('finance.discounts.fromChild')}</label>
                        <input id="fd-child" type="number" min="2" step="1" className="form-input" value={form.from_child}
                            onChange={e => set('from_child')(e.target.value)} />
                    </div>
                )}
            </div>
            {form.scope === 'students' && (
                <div className="mt-1">
                    <StudentMultiPicker value={students} onChange={setStudents} fetchStudents={findStudents}
                        label={t('finance.structure.students')} placeholder={t('finance.structure.findStudent')} />
                </div>
            )}
            <fieldset className="class-multi mt-1">
                <legend className="form-label">{t('finance.discounts.categoriesLabel')}</legend>
                <p className="text-xs-muted">
                    {form.categories.length ? '' : t('finance.discounts.allCategories')}
                </p>
                <div className="class-multi-streams">
                    {categories.map(c => (
                        <button key={c.code} type="button" aria-pressed={form.categories.includes(c.code)}
                            className={`class-picker-chip${form.categories.includes(c.code) ? ' active' : ''}`}
                            onClick={() => toggleCategory(c.code)}>
                            {categoryName(t, c.code, c.name)}
                        </button>
                    ))}
                </div>
            </fieldset>
            <label className="form-check mt-1">
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active')(e.target.checked)} />
                <span>{t('finance.discounts.active')}</span>
            </label>
        </Modal>
    )
}

/** The school's own list of kinds of charge. */
function CategoriesModal({ categories, onClose, onChanged }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)

    async function run(action, success) {
        setBusy(true)
        try {
            await action()
            if (success) toast.success(success)
            onChanged()
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title={t('finance.structure.categories')} icon="category" onClose={onClose}
            footer={<button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>}>
            <p className="text-xs-muted mb-1">{t('finance.structure.categoriesIntro')}</p>
            <ul className="row-list">
                {categories.map(category => (
                    <li key={category.id} className={`row-item${category.is_active ? '' : ' fin-line-off'}`}>
                        <div className="row-main">
                            <div className="u-strong u-sm">{categoryName(t, category.code, category.name)}</div>
                            <div className="text-xs-muted">{category.code}{category.in_use ? ` · ${t('finance.structure.inUse')}` : ''}</div>
                        </div>
                        <div className="row-actions">
                            {category.is_active ? (
                                <button className="btn btn-ghost btn-sm" disabled={busy}
                                    onClick={() => run(() => (category.in_use
                                        ? updateFeeCategory(category.id, { is_active: false })
                                        : deleteFeeCategory(category.id)))}>
                                    {category.in_use ? t('finance.structure.switchOff') : t('common.delete')}
                                </button>
                            ) : (
                                <button className="btn btn-ghost btn-sm" disabled={busy}
                                    onClick={() => run(() => updateFeeCategory(category.id, { is_active: true }))}>
                                    {t('finance.structure.switchOn')}
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            <div className="fin-add-category">
                <label className="form-label" htmlFor="fc-name">{t('finance.structure.newCategory')}</label>
                <div className="fin-add-category-row">
                    <input id="fc-name" className="form-input" value={name}
                        placeholder={t('finance.structure.newCategoryPlaceholder')}
                        onChange={e => setName(e.target.value)} />
                    <button className="btn btn-primary btn-sm" disabled={busy || !name.trim()}
                        onClick={() => run(() => createFeeCategory({ name: name.trim() }), t('common.saved'))
                            .then(() => setName(''))}>
                        {t('common.add')}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
