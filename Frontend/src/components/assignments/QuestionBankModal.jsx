import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { EmptyState } from '../ui/EmptyState'
import {
    getQuestionBank, patchQuestionBank, deleteFromQuestionBank,
} from '../../api/teacher'
import { QUESTION_TYPES } from './quizModel'

/**
 * The teacher's saved questions, for reuse across assignments.
 */
export function QuestionBankModal({ onClose, onImport }) {
    const { t } = useTranslation()
    const [bank,    setBank]    = useState([])
    const [loading, setLoading] = useState(true)
    const [search,  setSearch]  = useState('')
    const [typeF,   setTypeF]   = useState('')
    const [scope,   setScope]   = useState('')   // '' | 'mine' | 'shared'
    const [selected, setSelected] = useState(new Set())

    useEffect(() => {
        getQuestionBank(scope ? { scope } : undefined)
            .then(data => setBank(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [scope])

    const filtered = bank.filter(q => {
        if (typeF && q.question_type !== typeF) return false
        if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    async function toggleShare(q) {
        const updated = await patchQuestionBank(q.id, { is_shared: !q.is_shared }).catch(() => null)
        if (updated) setBank(prev => prev.map(b => b.id === q.id ? { ...b, is_shared: updated.is_shared } : b))
    }

    function toggle(id) {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    async function handleDelete(id) {
        await deleteFromQuestionBank(id).catch(() => {})
        setBank(prev => prev.filter(q => q.id !== id))
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    }

    function handleImport() {
        const toImport = filtered.filter(q => selected.has(q.id)).map(q => ({
            id:          String(Date.now() + Math.random()),
            type:        q.question_type,
            text:        q.text,
            options:     q.options || [],
            correct:     q.correct_answer ?? (q.question_type === 'mcq' || q.question_type === 'true_false' ? 0 : ''),
            points:      q.points || 1,
            explanation: q.explanation || '',
            image:       q.image || '',
        }))
        onImport(toImport)
        onClose()
    }

    const typeLabelKeys = {
        mcq:          'teacher.assignments.typeShortMcq',
        true_false:   'teacher.assignments.typeShortTrueFalse',
        short_answer: 'teacher.assignments.typeShortShort',
        fill_blank:   'teacher.assignments.typeShortFill',
    }

    return (
        <Modal title={t('teacher.assignments.bankTitle')} icon="library_books" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint">{t('teacher.assignments.selectedCount', { count: selected.size })}</span>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" disabled={selected.size === 0} onClick={handleImport}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                        {t('teacher.assignments.importSelected')}
                    </button>
                </div>
            }>
            <div className="bank-filter-row">
                <input className="form-control bank-search-input" placeholder={t('teacher.assignments.searchQuestions')}
                    value={search} onChange={e => setSearch(e.target.value)} />
                <select className="form-control bank-select-scope" value={scope} onChange={e => setScope(e.target.value)}
                    aria-label={t('teacher.assignments.questionScope')}>
                    <option value="">{t('teacher.assignments.allQuestions')}</option>
                    <option value="mine">{t('teacher.assignments.myQuestions')}</option>
                    <option value="shared">{t('teacher.assignments.sharedWithMe')}</option>
                </select>
                <select className="form-control bank-select-type" value={typeF} onChange={e => setTypeF(e.target.value)}>
                    <option value="">{t('teacher.assignments.allTypes')}</option>
                    {QUESTION_TYPES.map(qt => <option key={qt.value} value={qt.value}>{t(qt.labelKey)}</option>)}
                </select>
            </div>
            {loading ? (
                <p className="u-muted">{t('common.loading')}</p>
            ) : filtered.length === 0 ? (
                <p className="u-muted">{search || typeF
                    ? t('teacher.assignments.noMatchingQuestions')
                    : t('teacher.assignments.noSavedQuestions')}</p>
            ) : (
                <div className="bank-list">
                    {filtered.map(q => (
                        <div key={q.id} onClick={() => toggle(q.id)}
                            className={`bank-item${selected.has(q.id) ? ' selected' : ''}`}>
                            <input type="checkbox" readOnly checked={selected.has(q.id)} className="bank-item-check" />
                            <div className="bank-item-body">
                                <div className="bank-item-text">{q.text || t('teacher.assignments.noText')}</div>
                                <div className="bank-item-meta">
                                    {typeLabelKeys[q.question_type] ? t(typeLabelKeys[q.question_type]) : q.question_type}
                                    {' · '}{t('teacher.assignments.pointCount', { count: q.points })}
                                    {q.subject_name ? ` · ${q.subject_name}` : ''}
                                    {q.is_mine === false && q.teacher_name
                                        ? ' · ' + t('teacher.assignments.sharedBy', { name: q.teacher_name })
                                        : ''}
                                    {q.is_mine !== false && q.is_shared
                                        ? ' · ' + t('teacher.assignments.shared')
                                        : ''}
                                </div>
                            </div>
                            {q.is_mine !== false && (
                                <button type="button"
                                    onClick={e => { e.stopPropagation(); toggleShare(q) }}
                                    title={q.is_shared
                                        ? t('teacher.assignments.stopSharing')
                                        : t('teacher.assignments.startSharing')}
                                    className={`bank-item-icon-btn${q.is_shared ? ' shared' : ''}`}>
                                    <span className="material-symbols-rounded" aria-hidden="true">
                                        {q.is_shared ? 'group' : 'group_off'}
                                    </span>
                                </button>
                            )}
                            {q.is_mine !== false && (
                                <button type="button" onClick={e => { e.stopPropagation(); handleDelete(q.id) }}
                                    className="bank-item-icon-btn" aria-label={t('common.delete')}>
                                    <span className="material-symbols-rounded" aria-hidden="true">delete</span>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    )
}
