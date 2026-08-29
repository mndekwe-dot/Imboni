import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * How the work is handed in and handed back.
 *
 * These four settings existed in the database long before anything could set
 * them: `closed` was a status no code path reached, the time limit was a
 * countdown only the browser ran, a quiz could be retaken without limit, and a
 * mark was visible to the student and their parents the instant it was typed.
 * The backend enforces all of them now; this is where a teacher chooses.
 *
 * Kept out of the details card because these are policy, not description - a
 * teacher fills the details every time and touches these rarely.
 */
export function AssignmentRules({ form, onChange }) {
    const { t } = useTranslation()
    const fileRef = useRef(null)

    /* The value is a File once picked, a URL string when it came back from the
       API, and null when there is nothing (or it has been removed). */
    const attachment = form.attachment
    const attachmentName = attachment instanceof File
        ? attachment.name
        : typeof attachment === 'string'
            ? decodeURIComponent(attachment.split('/').pop())
            : null

    return (
        <div className="card u-mb">
            <div className="card-header">
                <h2 className="card-title">{t('teacher.assignments.rulesLabel')}</h2>
            </div>
            <div className="card-content">

                {/* Worksheet */}
                <div className="form-group">
                    <label className="form-label">{t('teacher.assignments.worksheet')}</label>
                    <input
                        ref={fileRef}
                        type="file"
                        className="u-hidden"
                        aria-label={t('teacher.assignments.worksheet')}
                        onChange={e => onChange({ attachment: e.target.files?.[0] ?? null })}
                    />
                    {attachmentName ? (
                        <div className="flex-row-gap-sm">
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">attach_file</span>
                            <span className="u-sm">{attachmentName}</span>
                            <button type="button" className="btn btn-outline btn-sm"
                                onClick={() => {
                                    /* null, not undefined: the API layer reads
                                       null as "clear the one already there". */
                                    onChange({ attachment: null })
                                    if (fileRef.current) fileRef.current.value = ''
                                }}>
                                {t('common.remove')}
                            </button>
                        </div>
                    ) : (
                        <button type="button" className="btn btn-outline btn-sm u-self-start"
                            onClick={() => fileRef.current?.click()}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">upload_file</span>
                            {t('teacher.assignments.attachWorksheet')}
                        </button>
                    )}
                    <p className="u-sm u-muted">{t('teacher.assignments.worksheetHint')}</p>
                </div>

                {/* Late work */}
                <div className="form-group shuffle-row col-full">
                    <input type="checkbox" id="accept-late" className="checkbox-sm"
                        checked={form.accept_late_submissions}
                        onChange={e => onChange({ accept_late_submissions: e.target.checked })} />
                    <label htmlFor="accept-late" className="u-pointer u-sm">
                        {t('teacher.assignments.acceptLate')}
                    </label>
                </div>

                {/* Mark release */}
                <div className="form-group shuffle-row col-full">
                    <input type="checkbox" id="release-now" className="checkbox-sm"
                        checked={form.release_marks_immediately}
                        onChange={e => onChange({ release_marks_immediately: e.target.checked })} />
                    <label htmlFor="release-now" className="u-pointer u-sm">
                        {t('teacher.assignments.releaseImmediately')}
                    </label>
                </div>
                {!form.release_marks_immediately && (
                    <p className="u-sm u-muted">{t('teacher.assignments.releaseHeldHint')}</p>
                )}

                {/* Attempts — a paper is handed in once, so this is quiz-only. */}
                {form.mode === 'online' && (
                    <div className="form-group">
                        <label className="form-label" htmlFor="max-attempts">
                            {t('teacher.assignments.attemptsAllowed')}
                        </label>
                        <input id="max-attempts" type="number" min="1" max="10"
                            className="form-control u-w-auto"
                            value={form.max_attempts}
                            onChange={e => onChange({ max_attempts: e.target.value })} />
                        <p className="u-sm u-muted">{t('teacher.assignments.attemptsHint')}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
