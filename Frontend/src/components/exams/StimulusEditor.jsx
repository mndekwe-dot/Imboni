import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { newStimulus } from './examModel'

/**
 * The passage, source or data a whole section refers to.
 *
 * Comprehension, history source work, geography data response and the
 * data-handling half of a science paper all share one shape: a block of
 * material printed once, followed by several questions about it. Without it a
 * teacher has to paste the passage into the first question, where it prints in
 * the wrong place and is invisible to every question after the first.
 *
 * `source_note` exists because attribution is part of the material in history
 * and language papers — "Adapted from…" is printed under the extract, not
 * inside it.
 */
export function StimulusEditor({ stimulus, onChange }) {
    const { t } = useTranslation()
    const fileRef = useRef(null)
    const value = stimulus || newStimulus()
    const has = Boolean(value.text || value.image || value.title)

    function set(field, v) { onChange({ ...value, [field]: v }) }

    /* Stored as a data URI, the same way question images already are: an exam
       paper has to print identically wherever it is opened, and a link to a
       file that moves is a paper that prints with a hole in it. */
    function pickImage(file) {
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => set('image', String(reader.result))
        reader.readAsDataURL(file)
    }

    if (!has) {
        return (
            <button type="button" className="btn btn-outline btn-sm u-self-start u-mb"
                onClick={() => onChange({ ...newStimulus(), title: t('teacher.exams.stimulusDefaultTitle') })}>
                <span className="material-symbols-rounded icon-sm">article_shortcut</span>
                {t('teacher.exams.addStimulus')}
            </button>
        )
    }

    return (
        <div className="exam-stimulus">
            <div className="flex-row-gap-sm u-mb-xs">
                <input className="form-control" value={value.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder={t('teacher.exams.stimulusTitle')} />
                <button type="button" className="btn btn-outline btn-sm"
                    onClick={() => onChange(newStimulus())}
                    title={t('teacher.exams.removeStimulus')}>
                    <span className="material-symbols-rounded icon-sm">delete</span>
                </button>
            </div>

            <textarea className="form-control" rows={6}
                value={value.text}
                onChange={e => set('text', e.target.value)}
                placeholder={t('teacher.exams.stimulusPlaceholder')} />

            <div className="flex-row-gap-sm u-mt-xs">
                <input className="form-control" value={value.source_note}
                    onChange={e => set('source_note', e.target.value)}
                    placeholder={t('teacher.exams.sourceNote')} />

                <input ref={fileRef} type="file" accept="image/*" className="u-hidden"
                    aria-label={t('teacher.exams.stimulusImage')}
                    onChange={e => pickImage(e.target.files?.[0])} />

                {value.image ? (
                    <button type="button" className="btn btn-outline btn-sm"
                        onClick={() => {
                            set('image', '')
                            if (fileRef.current) fileRef.current.value = ''
                        }}>
                        <span className="material-symbols-rounded icon-sm">hide_image</span>
                        {t('teacher.exams.removeImage')}
                    </button>
                ) : (
                    <button type="button" className="btn btn-outline btn-sm"
                        onClick={() => fileRef.current?.click()}>
                        <span className="material-symbols-rounded icon-sm">add_photo_alternate</span>
                        {t('teacher.exams.stimulusImage')}
                    </button>
                )}
            </div>

            {value.image && (
                <img src={value.image} alt="" className="exam-stimulus-img" />
            )}

            <p className="u-sm u-muted">{t('teacher.exams.notationHint')}</p>
        </div>
    )
}
