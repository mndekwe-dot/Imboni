import { useTranslation } from 'react-i18next'
import { QuestionEditor } from '../assignments/QuestionEditor'
import { EXAM_QUESTION_TYPES, newExamQuestion, sectionMarks } from './examModel'
import { QuestionExtras } from './QuestionExtras'
import { StimulusEditor } from './StimulusEditor'

/**
 * One section of an exam paper.
 *
 * The question editing itself is the shared `QuestionEditor` — a question is a
 * question whether it is sat on paper or on screen, and a second editor would
 * be a second definition of one. What a section adds is the rule above the
 * questions: how many of them the candidate must actually answer.
 */
export function SectionEditor({
    section, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast, onSaveToBank,
}) {
    const { t } = useTranslation()
    const questions = section.questions || []
    const choose = parseInt(section.choose_count) || 0
    const overAsked = choose > questions.length

    function set(field, value) { onChange({ ...section, [field]: value }) }

    function setQuestion(qi, updated) {
        set('questions', questions.map((q, i) => (i === qi ? updated : q)))
    }

    function removeQuestion(qi) {
        set('questions', questions.filter((_, i) => i !== qi))
    }

    function moveQuestion(qi, delta) {
        const next = [...questions]
        const [moved] = next.splice(qi, 1)
        next.splice(qi + delta, 0, moved)
        set('questions', next)
    }

    return (
        <div className="card u-mb">
            <div className="card-header exam-section-head">
                <input
                    className="form-control exam-section-title"
                    value={section.title}
                    onChange={e => set('title', e.target.value)}
                    aria-label={t('teacher.exams.sectionTitle')}
                    placeholder={t('teacher.exams.sectionTitle')}
                />
                <span className="u-muted u-sm">
                    {t('teacher.exams.sectionMarks', { marks: sectionMarks(section) })}
                </span>
                <div className="flex-row-gap-sm">
                    <button type="button" className="btn btn-outline btn-sm" disabled={isFirst}
                        onClick={onMoveUp} title={t('common.moveUp')}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">arrow_upward</span>
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={isLast}
                        onClick={onMoveDown} title={t('common.moveDown')}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">arrow_downward</span>
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={onRemove}
                        title={t('teacher.exams.removeSection')}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">delete</span>
                    </button>
                </div>
            </div>

            <div className="card-content">
                <div className="resp-grid-2 grid-gap-sm">
                    <div className="form-group">
                        <label className="form-label" htmlFor={`sec-inst-${index}`}>
                            {t('teacher.exams.sectionInstructions')}
                        </label>
                        <input id={`sec-inst-${index}`} className="form-control"
                            value={section.instructions}
                            onChange={e => set('instructions', e.target.value)}
                            placeholder={t('teacher.exams.sectionInstructionsHint')} />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor={`sec-choose-${index}`}>
                            {t('teacher.exams.chooseCount')}
                        </label>
                        <input id={`sec-choose-${index}`} type="number" min="0"
                            max={questions.length || undefined}
                            className="form-control u-w-auto"
                            value={section.choose_count}
                            onChange={e => set('choose_count', e.target.value)} />
                        <p className="u-sm u-muted">
                            {choose > 0
                                ? t('teacher.exams.chooseHint', { choose, of: questions.length })
                                : t('teacher.exams.chooseAllHint')}
                        </p>
                        {/* Caught here as well as on the server, because the
                            teacher is the one who can fix it. */}
                        {overAsked && (
                            <p className="u-sm form-error">{t('teacher.exams.chooseTooMany')}</p>
                        )}
                    </div>
                </div>

                {/* The passage, source or data these questions refer to. */}
                <StimulusEditor
                    stimulus={section.stimulus}
                    onChange={stimulus => set('stimulus', stimulus)}
                />

                {questions.map((q, qi) => (
                    <div key={q.id ?? qi} className="exam-question">
                    <QuestionEditor
                        q={q} qi={qi}
                        types={EXAM_QUESTION_TYPES}
                        onChange={updated => setQuestion(qi, updated)}
                        onRemove={() => removeQuestion(qi)}
                        onSaveToBank={onSaveToBank ? () => onSaveToBank(q) : undefined}
                        onMoveUp={() => moveQuestion(qi, -1)}
                        onMoveDown={() => moveQuestion(qi, 1)}
                        isFirst={qi === 0}
                        isLast={qi === questions.length - 1}
                    />
                    <QuestionExtras q={q} onChange={updated => setQuestion(qi, updated)} />
                    </div>
                ))}

                <button type="button" className="btn btn-outline btn-sm u-self-start"
                    onClick={() => set('questions', [...questions, newExamQuestion()])}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('teacher.exams.addQuestion')}
                </button>
            </div>
        </div>
    )
}
