/**
 * The shape of a quiz question, and the arithmetic over a set of them.
 *
 * Lives here rather than in a page because three separate screens now agree on
 * it: the assignment form that builds questions, the preview that renders them
 * as a student would see them, and the question bank that stores and returns
 * them. A second copy of `newQuestion` anywhere would be a second definition of
 * what a question is.
 */

export const QUESTION_TYPES = [
    { value: 'mcq',          labelKey: 'teacher.assignments.qTypeMcq',         icon: 'radio_button_checked' },
    { value: 'true_false',   labelKey: 'teacher.assignments.qTypeTrueFalse',   icon: 'check_circle'         },
    { value: 'short_answer', labelKey: 'teacher.assignments.qTypeShortAnswer', icon: 'short_text'           },
    { value: 'fill_blank',   labelKey: 'teacher.assignments.qTypeFillBlank',   icon: 'text_fields'          },
]

export const EMPTY_FORM = {
    title: '', class_obj: '', subject: '', due_date: '',
    max_score: '', instructions: '', status: 'draft', mode: 'paper',
    time_limit_minutes: '', shuffle_questions: false,
    // How the work is handed in and handed back. The defaults match what the
    // system did before these were settable: late work taken, one attempt at a
    // quiz, marks visible as soon as they are entered.
    accept_late_submissions: true,
    max_attempts: '1',
    release_marks_immediately: true,
    attachment: null,
}

export function newQuestion(type = 'mcq') {
    return {
        id:          String(Date.now() + Math.random()),
        type,
        text:        '',
        options:     type === 'mcq' ? ['', '', '', ''] : [],
        correct:     (type === 'short_answer' || type === 'fill_blank') ? '' : 0,
        points:      1,
        explanation: '',
        image:       '',
    }
}

export function calcMaxScore(questions) {
    return questions.reduce((s, q) => s + (parseInt(q.points) || 1), 0)
}
