import { useTranslation } from 'react-i18next'
import { ANSWER_SPACES, newPart, questionMarks } from './examModel'

/**
 * Everything a printed exam question needs that a quiz question does not.
 *
 * Kept beside the shared `QuestionEditor` rather than inside it: a quiz has no
 * sub-questions, no answer space and no marking-scheme text, and pushing all
 * of that into the component both screens share would make the quiz builder
 * carry fields it can never use.
 *
 * What is here is what a paper cannot be written without:
 *
 *  - **Parts.** "3 (a) … (b) …" is how most secondary questions are actually
 *    set, in every subject. Marks live on the part, because that is where they
 *    are earned, and the stem shows their sum.
 *  - **Answer space.** Ruled lines for a written answer, a blank box to work a
 *    calculation in, squares for a graph. Without it a paper prints with
 *    nowhere to write.
 *  - **Code and matching pairs**, for the subjects a plain text box cannot
 *    express.
 */
export function QuestionExtras({ q, onChange }) {
    const { t } = useTranslation()
    const parts = q.parts || []
    const pairs = q.pairs || []

    function set(field, value) { onChange({ ...q, [field]: value }) }

    function setPart(i, updated) {
        set('parts', parts.map((p, x) => (x === i ? updated : p)))
    }

    function setPair(i, field, value) {
        set('pairs', pairs.map((p, x) => (x === i ? { ...p, [field]: value } : p)))
    }

    return (
        <div className="exam-extras">

            {/* Code — whitespace is the meaning, so it is a plain textarea. */}
            {q.type === 'code' && (
                <div className="form-group">
                    <label className="form-label">{t('teacher.exams.codeBlock')}</label>
                    <textarea className="form-control code-input" rows={5} spellCheck={false}
                        value={q.code || ''}
                        onChange={e => set('code', e.target.value)}
                        placeholder={t('teacher.exams.codePlaceholder')} />
                </div>
            )}

            {/* Matching — two columns the candidate joins. */}
            {q.type === 'matching' && (
                <div className="form-group">
                    <label className="form-label">{t('teacher.exams.pairs')}</label>
                    {pairs.map((pair, i) => (
                        <div key={i} className="flex-row-gap-sm u-mb-xs">
                            <input className="form-control" value={pair.left}
                                onChange={e => setPair(i, 'left', e.target.value)}
                                placeholder={t('teacher.exams.columnA')} />
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">arrow_forward</span>
                            <input className="form-control" value={pair.right}
                                onChange={e => setPair(i, 'right', e.target.value)}
                                placeholder={t('teacher.exams.columnB')} />
                            <button type="button" className="btn btn-outline btn-sm"
                                onClick={() => set('pairs', pairs.filter((_, x) => x !== i))}
                                title={t('common.remove')}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">close</span>
                            </button>
                        </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm u-self-start"
                        onClick={() => set('pairs', [...pairs, { left: '', right: '' }])}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                        {t('teacher.exams.addPair')}
                    </button>
                </div>
            )}

            {/* Answer space — only meaningful when the stem is answered directly;
                a question with parts gets it per part instead. */}
            {parts.length === 0 && (
                <div className="resp-grid-2 grid-gap-sm">
                    <div className="form-group">
                        <label className="form-label">{t('teacher.exams.answerSpace')}</label>
                        <div className="quiz-q-type-row">
                            {ANSWER_SPACES.map(space => (
                                <button key={space.value} type="button"
                                    className={`btn btn-sm ${q.answer_space === space.value ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => set('answer_space', space.value)}>
                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">{space.icon}</span>
                                    {t(space.labelKey)}
                                </button>
                            ))}
                        </div>
                    </div>
                    {q.answer_space === 'lines' && (
                        <div className="form-group">
                            <label className="form-label">{t('teacher.exams.lineCount')}</label>
                            <input type="number" min="1" max="40" className="form-control u-w-auto"
                                value={q.lines ?? 3}
                                onChange={e => set('lines', e.target.value)} />
                        </div>
                    )}
                </div>
            )}

            {/* Sub-questions. */}
            <div className="form-group">
                <div className="flex-row-gap-sm">
                    <label className="form-label">{t('teacher.exams.parts')}</label>
                    {parts.length > 0 && (
                        <span className="u-muted u-sm">
                            {t('teacher.exams.partsTotal', { marks: questionMarks(q) })}
                        </span>
                    )}
                </div>

                {parts.map((part, i) => (
                    <div key={part.id ?? i} className="exam-part">
                        <div className="flex-row-gap-sm u-mb-xs">
                            <span className="quiz-q-num">
                                ({String.fromCharCode(97 + i)})
                            </span>
                            <input className="form-control" value={part.text}
                                onChange={e => setPart(i, { ...part, text: e.target.value })}
                                placeholder={t('teacher.exams.partPlaceholder')} />
                            <input type="number" min="0" className="form-control u-w-auto"
                                value={part.points}
                                onChange={e => setPart(i, { ...part, points: e.target.value })}
                                aria-label={t('teacher.exams.partMarks')} />
                            <button type="button" className="btn btn-outline btn-sm"
                                onClick={() => set('parts', parts.filter((_, x) => x !== i))}
                                title={t('common.remove')}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">close</span>
                            </button>
                        </div>

                        <div className="flex-row-gap-sm exam-part-space">
                            {ANSWER_SPACES.map(space => (
                                <button key={space.value} type="button"
                                    className={`btn btn-sm ${part.answer_space === space.value ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setPart(i, { ...part, answer_space: space.value })}
                                    title={t(space.labelKey)}>
                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">{space.icon}</span>
                                </button>
                            ))}
                            {/* The expected answer for this part, printed on the
                                marking scheme and never on the paper. */}
                            <input className="form-control" value={part.answer || ''}
                                onChange={e => setPart(i, { ...part, answer: e.target.value })}
                                placeholder={t('teacher.exams.partAnswerPlaceholder')} />
                        </div>
                    </div>
                ))}

                <button type="button" className="btn btn-outline btn-sm u-self-start"
                    onClick={() => set('parts', [...parts, newPart()])}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">subdirectory_arrow_right</span>
                    {t('teacher.exams.addPart')}
                </button>
                <p className="u-sm u-muted">{t('teacher.exams.partsHint')}</p>
            </div>
        </div>
    )
}
