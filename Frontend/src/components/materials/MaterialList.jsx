import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterBar } from '../ui/FilterBar'
import { EmptyState } from '../ui/EmptyState'
import { formatDate } from '../../utils/date'
import '../../styles/components.css'

const ICON = { video: 'smart_display', link: 'link' }

function iconFor(material) {
    if (ICON[material.kind]) return ICON[material.kind]
    return /\.pdf$/i.test(material.file_name || '') ? 'picture_as_pdf' : 'description'
}

export function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Materials in subject order, each subject's newest first. */
export function groupBySubject(materials) {
    const groups = new Map()
    for (const m of materials) {
        const key = m.subject_name || ''
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(m)
    }
    return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([subject, items]) => ({
            subject,
            items: [...items].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        }))
}

/**
 * Notes, slides and links, one card per subject. The same list for the
 * teacher who shared them and the student and parent who read them; the
 * teacher's copy passes `actions` for edit and delete, and `showClass`,
 * because one teacher's list spans several classes.
 */
export function MaterialList({ materials, actions, showClass = false }) {
    const { t } = useTranslation()

    return groupBySubject(materials).map(({ subject, items }) => (
        <section key={subject} className="card">
            <div className="card-header">
                <h2 className="card-title">{subject}</h2>
                <span className="u-sm u-muted">{t('materials.count', { count: items.length })}</span>
            </div>
            <ul className="material-list">
                {items.map(m => {
                    const href = m.file || m.url
                    const meta = [
                        showClass ? m.class_name : m.teacher_name,
                        formatDate(m.created_at),
                        m.kind === 'file' ? formatBytes(m.file_size) : t(`materials.kindNames.${m.kind}`),
                    ].filter(Boolean).join(' · ')
                    return (
                        <li key={m.id} className="material-row">
                            <span className={`material-symbols-rounded material-icon material-icon--${m.kind}`}
                                aria-hidden="true">{iconFor(m)}</span>
                            <div className="material-body">
                                <a className="material-title" href={href} target="_blank" rel="noopener noreferrer">
                                    {m.title}
                                </a>
                                {m.description && <p className="material-desc">{m.description}</p>}
                                <p className="u-sm u-muted">{meta}</p>
                            </div>
                            <div className="material-actions">
                                <a className="btn btn-outline btn-sm" href={href} target="_blank"
                                    rel="noopener noreferrer" aria-label={`${m.title}: ${m.kind === 'video' ? t('materials.watch') : t('materials.open')}`}>
                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">open_in_new</span>
                                    {m.kind === 'video' ? t('materials.watch') : t('materials.open')}
                                </a>
                                {actions?.(m)}
                            </div>
                        </li>
                    )
                })}
            </ul>
        </section>
    ))
}

/**
 * What a student or parent reads: every subject, or one at a time once there
 * is more than one to choose between.
 */
export function ClassMaterials({ materials }) {
    const { t } = useTranslation()
    const [subject, setSubject] = useState('all')

    if (materials.length === 0) {
        return <EmptyState icon="folder_open" title={t('materials.emptyTitle')}
            description={t('materials.emptyMessage')} />
    }

    const subjects = groupBySubject(materials)
    const active = subjects.some(g => g.subject === subject) ? subject : 'all'
    const options = [
        { key: 'all', label: t('materials.allSubjects'), count: materials.length },
        ...subjects.map(g => ({ key: g.subject, label: g.subject, count: g.items.length })),
    ]

    return (
        <>
            {subjects.length > 1 && <FilterBar options={options} active={active} onChange={setSubject} />}
            <MaterialList materials={active === 'all' ? materials : materials.filter(m => m.subject_name === active)} />
        </>
    )
}
