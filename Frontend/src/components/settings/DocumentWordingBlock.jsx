import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { updateSchoolSettings } from '../../api/dos'

// Mirrors apps.common.branding.DOCUMENT_TEXT_FIELDS: key, size, limit and the
// wording used when the school leaves it blank. Plain text only: a school can
// reword what it prints but cannot change the template itself.
const FIELDS = [
    { key: 'motto', rows: 1, max: 120, group: 'letterhead' },
    { key: 'footer_text', rows: 1, max: 160, group: 'letterhead' },
    { key: 'report_note', rows: 3, max: 300, group: 'report' },
    { key: 'report_signatory_left', rows: 1, max: 60, group: 'report', fallback: "Class Teacher's Signature:" },
    { key: 'report_signatory_right', rows: 1, max: 60, group: 'report', fallback: 'The School HeadMaster' },
    { key: 'exam_instructions', rows: 4, max: 600, group: 'exam' },
]

/**
 * What the school's own printed pages say: the line under the name, the footer,
 * the report-card note and signature labels, the default exam instructions.
 * The layout is fixed on purpose; free-form template editing would let one
 * school run code on a server shared with every other.
 */
export function DocumentWordingBlock({ initial }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [text, setText] = useState({})
    const [busy, setBusy] = useState(false)

    useEffect(() => { setText(initial || {}) }, [initial])

    async function save() {
        setBusy(true)
        try {
            await updateSchoolSettings({ document_text: text })
            toast.success(t('admin.settings.docSaved'))
        } catch (err) {
            toast.error(errorMessage(err, t('admin.settings.docFailed')))
        } finally { setBusy(false) }
    }

    return (
        <div className="doc-wording">
            <p className="settings-block-title">{t('admin.settings.docTitle')}</p>
            <p className="settings-block-desc">{t('admin.settings.docDesc')}</p>
            {FIELDS.map((f, i) => {
                const heading = f.group !== FIELDS[i - 1]?.group ? t(`admin.settings.docGroup_${f.group}`) : null
                const Tag = f.rows > 1 ? 'textarea' : 'input'
                return (
                    <div key={f.key}>
                        {heading && <p className="doc-wording-group">{heading}</p>}
                        <label className="doc-wording-field">
                            <span>{t(`admin.settings.doc_${f.key}`)}</span>
                            <Tag className="form-input" rows={f.rows > 1 ? f.rows : undefined} maxLength={f.max}
                                value={text[f.key] || ''} placeholder={f.fallback || t(`admin.settings.docHint_${f.key}`)}
                                onChange={e => setText(prev => ({ ...prev, [f.key]: e.target.value }))} />
                        </label>
                    </div>
                )
            })}
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{t('admin.settings.docSave')}</button>
        </div>
    )
}
