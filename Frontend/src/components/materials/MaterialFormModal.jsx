import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { FormSelect } from '../ui/FormSelect'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { createTeacherMaterial, updateTeacherMaterial } from '../../api/teacher'

export const MAX_FILE_BYTES = 25 * 1024 * 1024

/**
 * Share a file or a link with one class and subject the teacher teaches.
 *
 * `classSubjects` is the teacher's my-classes list ({class_id, class_name,
 * subject_id, subject_name}); the subject choices follow the class, so a
 * material cannot be filed under a subject the teacher does not teach there.
 * A failed save keeps the form open with the reason, so nothing typed is lost.
 */
export function MaterialFormModal({ material, classSubjects, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const fileRef = useRef(null)
    const isEdit = Boolean(material)

    const [form, setForm] = useState(() => ({
        title:       material?.title ?? '',
        description: material?.description ?? '',
        class_obj:   material ? String(material.class_id) : '',
        subject:     material ? String(material.subject_id) : '',
        kind:        material && material.kind !== 'file' ? 'link' : 'file',
        url:         material?.url ?? '',
        file:        null,
    }))
    const [saving, setSaving] = useState(false)
    const [error,  setError]  = useState(null)

    const set = patch => setForm(prev => ({ ...prev, ...patch }))

    const classOptions = [...new Map(classSubjects.map(cs =>
        [String(cs.class_id), { value: String(cs.class_id), label: cs.class_name }])).values()]
    const subjectOptions = classSubjects
        .filter(cs => String(cs.class_id) === form.class_obj)
        .map(cs => ({ value: String(cs.subject_id), label: cs.subject_name }))

    function changeClass(value) {
        const valid = classSubjects.filter(cs => String(cs.class_id) === value).map(cs => String(cs.subject_id))
        // One subject in that class: nothing to choose.
        set({ class_obj: value, subject: valid.includes(form.subject) ? form.subject : valid.length === 1 ? valid[0] : '' })
    }

    function pickFile(file) {
        if (file && file.size > MAX_FILE_BYTES) {
            setError(t('materials.fileTooLarge'))
            if (fileRef.current) fileRef.current.value = ''
            return
        }
        setError(null)
        set({ file: file ?? null, title: form.title || (file ? file.name.replace(/\.[^.]+$/, '') : '') })
    }

    const hasExistingFile = isEdit && material.kind === 'file'
    const urlOk = /^https?:\/\/\S+\.\S+/i.test(form.url.trim())
    const contentOk = form.kind === 'file' ? Boolean(form.file || hasExistingFile) : urlOk
    const canSave = form.title.trim() && form.class_obj && form.subject && contentOk && !saving

    async function save(e) {
        e.preventDefault()
        if (form.kind === 'link' && !urlOk) { setError(t('materials.urlInvalid')); return }
        if (!canSave) return
        setSaving(true)
        setError(null)
        const body = {
            title: form.title.trim(),
            description: form.description.trim(),
            class_obj: form.class_obj,
            subject: form.subject,
        }
        if (form.kind === 'link') body.url = form.url.trim()
        else if (form.file) body.file = form.file
        try {
            const saved = isEdit
                ? await updateTeacherMaterial(material.id, body)
                : await createTeacherMaterial(body)
            toast.success(t(isEdit ? 'materials.updated' : 'materials.created'))
            onSaved(saved)
        } catch (err) {
            const message = errorMessage(err, t('materials.saveFailed'))
            setError(message)
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    const fileName = form.file?.name ?? (hasExistingFile ? material.file_name : '')

    return (
        <Modal
            title={t(isEdit ? 'materials.editTitle' : 'materials.shareTitle')}
            icon="folder_open"
            onClose={onClose}
            footer={<>
                <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                <button type="submit" form="material-form" className="btn btn-primary" disabled={!canSave}>
                    {saving ? t('common.saving') : isEdit ? t('common.save') : t('materials.share')}
                </button>
            </>}
        >
            <form id="material-form" className="u-stack-1" onSubmit={save} noValidate>
                {error && <p className="form-error" role="alert">{error}</p>}

                <div className="form-group">
                    <label className="form-label" htmlFor="material-title">{t('materials.titleLabel')}</label>
                    <input id="material-title" className="form-input" value={form.title} maxLength={200}
                        placeholder={t('materials.titlePlaceholder')}
                        onChange={e => set({ title: e.target.value })} />
                </div>

                <div className="class-select">
                    <div className="form-group">
                        <label className="form-label" htmlFor="material-class">{t('common.classRequired')}</label>
                        <FormSelect id="material-class" value={form.class_obj} onChange={changeClass}
                            placeholder={t('common.class')} options={classOptions} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="material-subject">{t('common.subjectRequired')}</label>
                        <FormSelect id="material-subject" value={form.subject} onChange={v => set({ subject: v })}
                            placeholder={form.class_obj ? t('common.subject') : t('materials.chooseClassFirst')}
                            disabled={!form.class_obj} options={subjectOptions} />
                    </div>
                </div>

                <fieldset className="form-group material-kind-set">
                    <legend className="form-label">{t('materials.kindLabel')}</legend>
                    <div className="material-kind">
                        {[['file', 'kindFile'], ['link', 'kindLink']].map(([value, key]) => (
                            <label key={value} className="flex-row-gap-sm">
                                <input type="radio" name="material-kind" value={value}
                                    checked={form.kind === value}
                                    onChange={() => { setError(null); set({ kind: value }) }} />
                                {t(`materials.${key}`)}
                            </label>
                        ))}
                    </div>
                </fieldset>

                {form.kind === 'file' ? (
                    <div className="form-group">
                        <input ref={fileRef} type="file" className="u-hidden"
                            aria-label={t('materials.chooseFile')}
                            onChange={e => pickFile(e.target.files?.[0])} />
                        <div className="flex-row-gap-sm">
                            <button type="button" className="btn btn-outline btn-sm"
                                onClick={() => fileRef.current?.click()}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">upload_file</span>
                                {fileName ? t('materials.replaceFile') : t('materials.chooseFile')}
                            </button>
                            {fileName && <span className="u-sm">{fileName}</span>}
                        </div>
                        <p className="u-sm u-muted">{t('materials.fileHint')}</p>
                    </div>
                ) : (
                    <div className="form-group">
                        <label className="form-label" htmlFor="material-url">{t('materials.urlLabel')}</label>
                        <input id="material-url" type="url" className="form-input" value={form.url}
                            placeholder="https://" onChange={e => set({ url: e.target.value })} />
                        <p className="u-sm u-muted">{t('materials.urlHint')}</p>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label" htmlFor="material-description">{t('materials.descriptionLabel')}</label>
                    <textarea id="material-description" className="form-input form-textarea" rows={3}
                        value={form.description} placeholder={t('materials.descriptionPlaceholder')}
                        onChange={e => set({ description: e.target.value })} />
                </div>
            </form>
        </Modal>
    )
}
