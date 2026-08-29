import { useTranslation } from 'react-i18next'
import { QuestionEditor } from './QuestionEditor'
import { QUESTION_TYPES, newQuestion, calcMaxScore } from './quizModel'
import { saveToQuestionBank } from '../../api/teacher'

/**
 * The ordered list of questions, with the controls to add, reorder and remove
 * them. Owns no state of its own - the list is passed in and every change goes
 * back out through onChange, so the page holding it stays the single source.
 */
export function QuizBuilder({ questions, onChange, onOpenBank }) {
    const { t } = useTranslation()
    function update(id, updated) { onChange(questions.map(q => q.id === id ? updated : q)) }
    function remove(id)          { onChange(questions.filter(q => q.id !== id)) }
    function moveUp(idx) {
        if (idx === 0) return
        const qs = [...questions]
        ;[qs[idx - 1], qs[idx]] = [qs[idx], qs[idx - 1]]
        onChange(qs)
    }
    function moveDown(idx) {
        if (idx === questions.length - 1) return
        const qs = [...questions]
        ;[qs[idx], qs[idx + 1]] = [qs[idx + 1], qs[idx]]
        onChange(qs)
    }

    async function saveToBank(q) {
        try {
            await saveToQuestionBank({
                question_type:  q.type,
                text:           q.text,
                options:        q.options,
                correct_answer: q.correct,
                explanation:    q.explanation,
                points:         q.points,
                image:          q.image,
            })
            alert(t('teacher.assignments.savedToBank'))
        } catch { alert(t('teacher.assignments.saveQuestionFailed')) }
    }

    const totalPoints = calcMaxScore(questions)

    return (
        <div>
            {questions.length === 0 ? (
                <div className="quiz-q-empty">{t('teacher.assignments.noQuestions')}</div>
            ) : (
                <>
                    <div className="u-flex u-justify-end u-mb-xs">
                        <span className="quiz-section-count">
                            {t('teacher.assignments.questionCount', { count: questions.length })} ·{' '}
                            {t('teacher.assignments.markCount', { count: totalPoints })}
                        </span>
                    </div>
                    {questions.map((q, qi) => (
                        <QuestionEditor key={q.id} q={q} qi={qi}
                            onChange={updated => update(q.id, updated)}
                            onRemove={() => remove(q.id)}
                            onSaveToBank={saveToBank}
                            onMoveUp={() => moveUp(qi)}
                            onMoveDown={() => moveDown(qi)}
                            isFirst={qi === 0}
                            isLast={qi === questions.length - 1}
                        />
                    ))}
                </>
            )}

            {/* Add buttons */}
            <div className="quiz-add-row">
                {QUESTION_TYPES.map(qt => (
                    <button key={qt.value} type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onChange([...questions, newQuestion(qt.value)])}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">{qt.icon}</span>
                        + {t(qt.labelKey)}
                    </button>
                ))}
                <button type="button" className="btn btn-outline btn-sm u-ml-auto" onClick={onOpenBank}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">library_books</span>
                    {t('teacher.assignments.importFromBank')}
                </button>
            </div>
        </div>
    )
}
