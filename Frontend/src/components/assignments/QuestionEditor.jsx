import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QUESTION_TYPES } from './quizModel'

/**
 * One question in the quiz builder: its type, its text, its answers, its marks.
 *
 * Every question type is edited in this one component rather than four, because
 * the frame around the answers - number, type row, image, points, explanation -
 * is identical for all of them and only the answer block differs.
 */
/**
 * `types` lets a caller narrow or widen what a question may be. A quiz only
 * offers what can be auto-marked; a printed exam paper also wants essay and
 * structured questions, which a machine cannot mark and a person will.
 */
export function QuestionEditor({ q, qi, onChange, onRemove, onSaveToBank, onMoveUp, onMoveDown,
                                 isFirst, isLast, types = QUESTION_TYPES }) {
    const { t } = useTranslation()
    const qType = types.find(qt => qt.value === q.type)

    function set(field, value) { onChange({ ...q, [field]: value }) }

    function setOption(idx, value) {
        const opts = [...q.options]; opts[idx] = value; set('options', opts)
    }

    function addOption() { set('options', [...q.options, '']) }
    function removeOption(idx) {
        const opts = q.options.filter((_, i) => i !== idx)
        set('options', opts)
        if (q.correct >= opts.length) set('correct', Math.max(0, opts.length - 1))
    }

    function handleImage(e) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onloadend = () => set('image', reader.result)
        reader.readAsDataURL(file)
    }

    const imgRef = useRef()

    return (
        <div className="quiz-q u-relative">
            {/* Question header row */}
            <div className="quiz-q-header top">
                <span className="quiz-q-num">{qi + 1}</span>

                {/* Type selector */}
                <div className="quiz-q-type-col">
                    <div className="quiz-q-type-row">
                        {types.map(qt => (
                            <button key={qt.value} type="button"
                                onClick={() => {
                                    const updated = { ...q, type: qt.value }
                                    if (qt.value === 'true_false') { updated.options = []; updated.correct = 0 }
                                    else if (qt.value === 'mcq' && q.options.length === 0) { updated.options = ['', '', '', '']; updated.correct = 0 }
                                    else if (qt.value === 'short_answer' || qt.value === 'fill_blank') { updated.options = []; updated.correct = '' }
                                    else if (qt.value === 'essay' || qt.value === 'structured') { updated.options = []; updated.correct = '' }
                                    onChange(updated)
                                }}
                                className={`quiz-q-type-btn${q.type === qt.value ? ' active' : ''}`}>
                                <span className="material-symbols-rounded" aria-hidden="true">{qt.icon}</span>
                                {t(qt.labelKey)}
                            </button>
                        ))}
                    </div>

                    {/* Question text */}
                    {q.type === 'fill_blank' ? (
                        <div>
                            <input
                                className="form-control"
                                placeholder={t('teacher.assignments.fillBlankPlaceholder', { n: qi + 1 })}
                                value={q.text}
                                onChange={e => set('text', e.target.value)}
                            />
                            <div className="quiz-q-hint">
                                {t('teacher.assignments.fillBlankHint')}
                            </div>
                        </div>
                    ) : (
                        <input
                            className="form-control"
                            placeholder={t('teacher.assignments.questionPlaceholder', { n: qi + 1 })}
                            value={q.text}
                            onChange={e => set('text', e.target.value)}
                        />
                    )}
                </div>

                {/* Move + delete */}
                <div className="quiz-q-tools">
                    {!isFirst && (
                        <button type="button" className="quiz-q-delete quiz-q-move" onClick={onMoveUp} title={t('common.moveUp')}>
                            <span className="material-symbols-rounded" aria-hidden="true">arrow_upward</span>
                        </button>
                    )}
                    {!isLast && (
                        <button type="button" className="quiz-q-delete quiz-q-move" onClick={onMoveDown} title={t('common.moveDown')}>
                            <span className="material-symbols-rounded" aria-hidden="true">arrow_downward</span>
                        </button>
                    )}
                    <button type="button" className="quiz-q-delete" onClick={onRemove} title={t('teacher.assignments.deleteQuestion')}>
                        <span className="material-symbols-rounded" aria-hidden="true">delete</span>
                    </button>
                </div>
            </div>

            {/* Image attachment */}
            <div className="quiz-q-image-row">
                <input ref={imgRef} type="file" accept="image/*" className="quiz-q-file-input" onChange={handleImage} />
                {q.image ? (
                    <div className="u-row-sm">
                        <img src={q.image} alt="question" className="quiz-q-image" />
                        <button type="button" className="quiz-q-delete quiz-q-move" onClick={() => set('image', '')} title={t('common.removeImage')}>
                            <span className="material-symbols-rounded" aria-hidden="true">close</span>
                        </button>
                    </div>
                ) : (
                    <button type="button" onClick={() => imgRef.current.click()} className="quiz-q-add-image">
                        <span className="material-symbols-rounded" aria-hidden="true">add_photo_alternate</span>
                        {t('common.addImage')}
                    </button>
                )}
            </div>

            {/* Answer options */}
            <div className="quiz-q-options">
                {q.type === 'mcq' && (
                    <>
                        {q.options.map((opt, oi) => (
                            <div key={oi} className={`quiz-q-option${q.correct === oi ? ' correct' : ''}`}>
                                <input type="radio" name={`correct-${q.id}`}
                                    checked={q.correct === oi} onChange={() => set('correct', oi)} />
                                <input className="quiz-q-option-input"
                                    placeholder={t('teacher.assignments.optionLetter', { letter: String.fromCharCode(65 + oi) })}
                                    value={opt} onChange={e => setOption(oi, e.target.value)} />
                                {q.options.length > 2 && (
                                    <button type="button" className="quiz-q-delete quiz-q-delete-sm" onClick={() => removeOption(oi)} aria-label={t('common.remove')}>
                                        <span className="material-symbols-rounded" aria-hidden="true">remove</span>
                                    </button>
                                )}
                            </div>
                        ))}
                        {q.options.length < 6 && (
                            <button type="button" onClick={addOption} className="quiz-q-add-option">
                                <span className="material-symbols-rounded" aria-hidden="true">add</span>
                                {t('teacher.assignments.addOption')}
                            </button>
                        )}
                        <div className="quiz-q-help">
                            <span className="material-symbols-rounded" aria-hidden="true">check_circle</span>
                            {' '}{t('teacher.assignments.mcqHelp')}
                        </div>
                    </>
                )}

                {q.type === 'true_false' && (
                    <>
                        {['True', 'False'].map((label, oi) => (
                            <div key={oi} className={`quiz-q-option${q.correct === oi ? ' correct' : ''}`}>
                                <input type="radio" name={`correct-${q.id}`}
                                    checked={q.correct === oi} onChange={() => set('correct', oi)} />
                                <span className="quiz-q-tf-label">{label}</span>
                            </div>
                        ))}
                        <div className="quiz-q-help">
                            <span className="material-symbols-rounded" aria-hidden="true">check_circle</span>
                            {' '}{t('teacher.assignments.trueFalseHelp')}
                        </div>
                    </>
                )}

                {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                    <div className="quiz-q-answer">
                        <label className="form-label">
                            {q.type === 'fill_blank'
                                ? t('teacher.assignments.expectedAnswer')
                                : t('teacher.assignments.modelAnswer')}{' '}
                            <span className="label-muted">{t('teacher.assignments.autoGradingHint')}</span>
                        </label>
                        <input className="form-control"
                            placeholder={q.type === 'fill_blank'
                                ? t('teacher.assignments.egParis')
                                : t('teacher.assignments.egLaw')}
                            value={q.correct || ''}
                            onChange={e => set('correct', e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Points + explanation row */}
            <div className="quiz-q-foot">
                <div className="quiz-q-points">
                    <label className="quiz-q-points-label">{t('teacher.assignments.pointsLabel')}</label>
                    <input type="number" min="1" max="100"
                        className="form-control quiz-q-points-input"
                        value={q.points} onChange={e => set('points', Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="quiz-q-expl">
                    <input className="form-control quiz-q-expl-input"
                        placeholder={t('teacher.assignments.explanationPlaceholder')}
                        value={q.explanation} onChange={e => set('explanation', e.target.value)} />
                </div>
                <button type="button"
                    onClick={() => onSaveToBank(q)}
                    title={t('teacher.assignments.saveToBankTitle')}
                    className="quiz-q-bank-btn">
                    <span className="material-symbols-rounded" aria-hidden="true">bookmark_add</span>
                    {t('teacher.assignments.saveToBank')}
                </button>
            </div>
        </div>
    )
}
