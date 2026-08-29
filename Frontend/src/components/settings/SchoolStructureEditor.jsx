import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { StatCard } from '../layout/StatCard'

/**
 * The school's year groups and streams — the one editor for all three portals.
 *
 * Admin, DOS and Discipline each carried their own copy of this, which meant the
 * same bug existed in three places: every add and remove button PUT the entire
 * structure to the server the moment it was clicked. One stray tap on a delete
 * icon removed a year group from a live school, with nothing to undo it.
 *
 * Two things changed:
 *
 *   1. Edits are held in a local draft. Nothing reaches the server until Save,
 *      and Discard puts everything back.
 *   2. A save that removes a year or a stream is refused by the server with 409
 *      and a list of what would go. That list is shown, named, and has to be
 *      accepted before the save is repeated with confirmation. A removal of
 *      something classes or pupils still use is refused outright and cannot be
 *      confirmed away.
 */

function TagList({ items, onRemove }) {
    const { t } = useTranslation()
    return (
        <div className="tag-list">
            {items.map(item => (
                <span key={item} className="tag-chip">
                    {item}
                    <button className="tag-chip-remove" onClick={() => onRemove(item)} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
                    </button>
                </span>
            ))}
            {items.length === 0 && <span className="tag-chip-empty">{t('settings.structure.noneAdded')}</span>}
        </div>
    )
}

function ConfigSection({ title, description, items, onAdd, onRemove, placeholder }) {
    const { t } = useTranslation()
    const [input, setInput] = useState('')

    function handleAdd() {
        const val = input.trim()
        if (!val || items.includes(val)) return
        onAdd(val)
        setInput('')
    }

    return (
        <div className="settings-block">
            <div className="settings-block-label">
                <p className="settings-block-title">{title}</p>
                <p className="settings-block-desc">{description}</p>
            </div>
            <div className="settings-block-input-row">
                <input
                    className="form-input flex-1"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={placeholder}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAdd}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span> {t('common.add')}
                </button>
            </div>
            <TagList items={items} onRemove={onRemove} />
        </div>
    )
}

function YearInput({ onAdd }) {
    const { t } = useTranslation()
    const [input, setInput] = useState('')
    function handle() {
        const val = input.trim()
        if (!val) return
        onAdd(val)
        setInput('')
    }
    return (
        <div className="settings-block-input-row u-mt-sm">
            <input
                className="form-input flex-1"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()}
                placeholder={t('settings.structure.yearPlaceholder')}
            />
            <button className="btn btn-primary btn-sm" onClick={handle}>
                <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span> {t('settings.structure.addYear')}
            </button>
        </div>
    )
}

function YearBlock({ year, onRename, onRemove, onAddStream, onRemoveStream }) {
    const { t } = useTranslation()
    const [editing,     setEditing]     = useState(false)
    const [draft,       setDraft]       = useState(year.name)
    const [streamInput, setStreamInput] = useState('')

    function commitRename() {
        const val = draft.trim()
        if (val && val !== year.name) onRename(year.name, val)
        setEditing(false)
    }

    function handleAddStream() {
        const val = streamInput.trim()
        if (!val) return
        onAddStream(val)
        setStreamInput('')
    }

    return (
        <div className="adm-editblock">
            <div className="adm-editblock-head">
                {editing ? (
                    <>
                        <input
                            className="form-input adm-input-year"
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setDraft(year.name) } }}
                            autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={commitRename}>{t('common.save')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditing(false); setDraft(year.name) }}>{t('common.cancel')}</button>
                    </>
                ) : (
                    <>
                        <span className="adm-editblock-title">{year.name}</span>
                        <button className="btn-icon-clean adm-icon-muted" onClick={() => setEditing(true)} title={t('settings.structure.renameYear')}>
                            <span className="material-symbols-rounded u-fs-1" aria-hidden="true">edit</span>
                        </button>
                        <div className="adm-spacer" />
                        <button className="btn-icon-clean adm-icon-danger" onClick={onRemove} title={t('settings.structure.removeYear')}>
                            <span className="material-symbols-rounded u-fs-1" aria-hidden="true">delete</span>
                        </button>
                    </>
                )}
            </div>

            <div className="tag-list u-mb-05">
                {year.streams.map(s => (
                    <span key={s} className="tag-chip">
                        {s}
                        <button className="tag-chip-remove" onClick={() => onRemoveStream(s)} aria-label={t('common.close')}>
                            <span className="material-symbols-rounded" aria-hidden="true">close</span>
                        </button>
                    </span>
                ))}
                {year.streams.length === 0 && <span className="tag-chip-empty">{t('settings.structure.noStreams')}</span>}
            </div>

            <div className="u-row-sm">
                <input
                    className="form-input adm-input-stream"
                    value={streamInput}
                    onChange={e => setStreamInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddStream()}
                    placeholder={t('settings.structure.streamPlaceholder')}
                />
                <button className="btn btn-outline btn-sm" onClick={handleAddStream}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span> {t('settings.structure.stream')}
                </button>
            </div>
        </div>
    )
}


export function SchoolStructureEditor({ showStats = true }) {
    const { t } = useTranslation()
    const toast = useToast()
    const { config, saveConfig, loading, error } = useSchoolConfig()
    const [saving, setSaving] = useState(false)
    const [saved,  setSaved]  = useState(false)

    // Edits live here until Save. This is what makes a misclick harmless.
    const [draft, setDraft] = useState(null)
    // What the server said this save would remove, awaiting a yes or no.
    const [pendingRemovals, setPendingRemovals] = useState(null)

    useEffect(() => { if (!loading) setDraft(config) }, [loading, config])

    if (loading || draft === null) return <p className="adm-set-note">{t('common.loading')}</p>
    if (error && !draft.length)    return <p className="adm-danger">{t('common.errorPrefix')}: {error}</p>

    const totalYears   = draft.reduce((sum, sec) => sum + sec.years.length, 0)
    const totalStreams = draft.reduce((sum, sec) => sum + sec.years.reduce((s, y) => s + y.streams.length, 0), 0)
    const dirty = JSON.stringify(draft) !== JSON.stringify(config)

    function addSection(name) {
        if (draft.find(s => s.name === name)) return
        setDraft([...draft, { name, years: [] }])
    }
    function removeSection(name) { setDraft(draft.filter(s => s.name !== name)) }

    function addYear(sectionName, yearName) {
        if (!yearName.trim()) return
        const sec = draft.find(s => s.name === sectionName)
        if (!sec || sec.years.find(y => y.name === yearName)) return
        setDraft(draft.map(s => s.name === sectionName
            ? { ...s, years: [...s.years, { name: yearName, streams: [] }] } : s))
    }
    function removeYear(sectionName, yearName) {
        setDraft(draft.map(s => s.name === sectionName
            ? { ...s, years: s.years.filter(y => y.name !== yearName) } : s))
    }
    function renameYear(sectionName, oldName, newName) {
        if (!newName.trim() || oldName === newName) return
        setDraft(draft.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === oldName ? { ...y, name: newName } : y) } : s))
    }
    function addStream(sectionName, yearName, stream) {
        if (!stream.trim()) return
        setDraft(draft.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === yearName && !y.streams.includes(stream)
                ? { ...y, streams: [...y.streams, stream] } : y) } : s))
    }
    function removeStream(sectionName, yearName, stream) {
        setDraft(draft.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === yearName
                ? { ...y, streams: y.streams.filter(st => st !== stream) } : y) } : s))
    }

    function discard() { setDraft(config); setPendingRemovals(null) }

    async function handleSave(confirm = false) {
        setSaving(true)
        try {
            await saveConfig(draft, { confirm })
            setPendingRemovals(null)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (e) {
            // 409: the save is valid but takes something away. The server sends
            // back exactly what, so the prompt names it rather than asking
            // "are you sure?" about nothing in particular.
            const data = e?.response?.data
            if (e?.response?.status === 409 && data?.removals?.length) {
                setPendingRemovals(data.removals)
            } else {
                toast.error(errorMessage(e, t('settings.structure.saveFailed')))
            }
        } finally { setSaving(false) }
    }

    return (
        <div>
            {showStats && draft.length > 0 && (
                <div className="adm-struct-stats">
                    {[
                        { icon: 'layers',         label: t('common.sections'),                   value: draft.length },
                        { icon: 'calendar_month', label: t('common.yearGroups'),                 value: totalYears   },
                        { icon: 'groups',         label: t('settings.structure.streamClasses'), value: totalStreams },
                    ].map(s => (
                        <StatCard key={s.icon} icon={s.icon} value={s.value}
                                  label={s.label} colorClass="info" className="adm-struct-stat" />
                    ))}
                </div>
            )}

            {draft.length === 0 && (
                <div className="card u-banner u-banner--primary u-mb">
                    <div className="u-row">
                        <span className="material-symbols-rounded u-banner-icon" aria-hidden="true">info</span>
                        <div>
                            <p className="u-strong u-mb-025">{t('settings.structure.gettingStarted')}</p>
                            <p className="u-muted u-sm">
                                {t('settings.structure.gettingStartedBody')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <ConfigSection
                title={t('settings.structure.addSection')}
                description={t('settings.structure.addSectionDesc')}
                items={draft.map(s => s.name)}
                onAdd={addSection}
                onRemove={removeSection}
                placeholder={t('settings.structure.sectionPlaceholder')}
            />

            {draft.length > 0 && (
                <div className="settings-border-section">
                    {draft.map(sec => (
                        <div key={sec.name} className="sec-config-block">
                            <p className="sec-config-block-title">{sec.name}</p>
                            <div className="settings-block">
                                <div className="settings-block-label">
                                    <p className="settings-block-title">{t('common.yearGroups')}</p>
                                    <p className="settings-block-desc">{t('settings.structure.yearGroupsDesc')}</p>
                                </div>
                                <YearInput onAdd={yearName => addYear(sec.name, yearName)} />
                            </div>
                            {sec.years.map(y => (
                                <YearBlock
                                    key={y.name}
                                    year={y}
                                    onRename={(old, next) => renameYear(sec.name, old, next)}
                                    onRemove={() => removeYear(sec.name, y.name)}
                                    onAddStream={stream => addStream(sec.name, y.name, stream)}
                                    onRemoveStream={stream => removeStream(sec.name, y.name, stream)}
                                />
                            ))}
                            {sec.years.length === 0 && (
                                <p className="u-muted u-sm u-mt-sm">
                                    {t('settings.structure.noYearGroups')}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {pendingRemovals && (
                <div className="card u-banner u-banner--danger u-mb" role="alert">
                    <div className="u-row">
                        <span className="material-symbols-rounded u-banner-icon" aria-hidden="true">warning</span>
                        <div>
                            <p className="u-strong u-mb-025">{t('settings.structure.removalTitle')}</p>
                            <ul className="u-muted u-sm u-mb-025">
                                {pendingRemovals.map(r => <li key={r}>{r}</li>)}
                            </ul>
                            <p className="u-muted u-sm">
                                {t('settings.structure.removalNote', { count: pendingRemovals.length })}
                            </p>
                        </div>
                    </div>
                    <div className="u-row u-gap-05 u-mt-sm">
                        <button className="btn btn-primary btn-destructive btn-sm"
                            onClick={() => handleSave(true)} disabled={saving}>
                            {saving ? t('settings.structure.removing') : t('settings.structure.yesRemove')}
                        </button>
                        <button className="btn btn-secondary btn-sm"
                            onClick={() => setPendingRemovals(null)}>
                            {t('settings.structure.keep', { count: pendingRemovals.length })}
                        </button>
                    </div>
                </div>
            )}

            <div className="cloud-save-row">
                <button className="btn btn-primary" onClick={() => handleSave(false)}
                    disabled={saving || !dirty}>
                    {saved ? t('settings.savedBang') : saving ? t('common.saving') : dirty ? t('common.saveChanges') : t('common.saved')}
                </button>
                {dirty && (
                    <>
                        <button className="btn btn-secondary" onClick={discard} disabled={saving}>
                            {t('common.discardChanges')}
                        </button>
                        <span className="u-muted u-sm">{t('common.unsavedChanges')}</span>
                    </>
                )}
            </div>
        </div>
    )
}
