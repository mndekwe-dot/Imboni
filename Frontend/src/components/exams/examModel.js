import { QUESTION_TYPES, newQuestion } from '../assignments/quizModel'

/**
 * The shape of an exam paper, and the arithmetic over its sections.
 *
 * An exam is not just a longer quiz. A quiz is a flat list of questions a
 * machine marks; a paper is divided into sections, and a section can say
 * "answer any three of these six" — which changes what the paper is out of.
 * That one rule is why this file exists rather than reusing the quiz model.
 */

/**
 * Everything a quiz can ask, plus the two kinds only a person can mark.
 *
 * Quizzes deliberately keep the shorter list: offering an essay in an
 * auto-marked quiz would promise a mark the system cannot produce.
 */
export const EXAM_QUESTION_TYPES = [
    ...QUESTION_TYPES,
    { value: 'structured', labelKey: 'teacher.exams.qTypeStructured', icon: 'segment' },
    { value: 'essay',      labelKey: 'teacher.exams.qTypeEssay',      icon: 'article' },
    { value: 'matching',   labelKey: 'teacher.exams.qTypeMatching',   icon: 'compare_arrows' },
    { value: 'code',       labelKey: 'teacher.exams.qTypeCode',       icon: 'code' },
]

/**
 * Where the candidate writes.
 *
 * A paper printed with nowhere to answer is a paper answered in the margin,
 * and what "somewhere" means depends entirely on the subject: ruled lines for
 * a written answer, a blank box to work a calculation in, squares for a graph.
 */
export const ANSWER_SPACES = [
    { value: 'lines',   labelKey: 'teacher.exams.spaceLines',   icon: 'notes' },
    { value: 'working', labelKey: 'teacher.exams.spaceWorking', icon: 'calculate' },
    { value: 'grid',    labelKey: 'teacher.exams.spaceGrid',    icon: 'grid_on' },
    { value: 'none',    labelKey: 'teacher.exams.spaceNone',    icon: 'block' },
]

/** A shared passage, source or data table several questions refer to. */
export function newStimulus() {
    return { title: '', text: '', image: '', source_note: '' }
}

/** One sub-question: 1 (a), 1 (b). */
export function newPart() {
    return {
        id: String(Date.now() + Math.random()),
        text: '', points: 2, answer_space: 'lines', lines: 3, answer: '',
    }
}

export const EMPTY_EXAM = {
    title: '', subject: '', class_obj: '', term: '',
    exam_type: 'final', duration_minutes: '120', instructions: '',
}

export function newSection(index = 0) {
    return {
        id: String(Date.now() + Math.random()),
        // Sections are lettered the way a paper letters them.
        title: `Section ${String.fromCharCode(65 + index)}`,
        instructions: '',
        // 0 means every question is compulsory.
        choose_count: 0,
        questions: [],
    }
}

export function newExamQuestion(type = 'structured') {
    // Exams default to a written question: the common case on a printed paper
    // is one a teacher marks, not one the system does.
    return {
        ...newQuestion(type),
        points: 5,
        parts: [],
        answer_space: 'lines',
        lines: 3,
        code: '',
        pairs: [],
    }
}

/**
 * What one question is worth.
 *
 * A structured question carries its marks on its parts, and the number beside
 * the stem is their sum — the server computes it the same way, so the running
 * total while writing matches the total printed on the paper.
 */
export function questionMarks(q) {
    const parts = q.parts || []
    if (parts.length) return parts.reduce((s, p) => s + (parseInt(p.points) || 0), 0)
    return parseInt(q.points) || 0
}

/**
 * What one section is worth.
 *
 * A section where the candidate answers three of six is worth three questions,
 * not six. Highest-scoring first, because that is the most a candidate could
 * earn — the same rule the server applies, kept identical so the total a
 * teacher sees while writing matches the total printed on the paper.
 */
export function sectionMarks(section) {
    const points = (section.questions || [])
        .map(questionMarks)
        .sort((a, b) => b - a)
    const choose = parseInt(section.choose_count) || 0
    const counted = choose > 0 && choose <= points.length ? points.slice(0, choose) : points
    return counted.reduce((sum, p) => sum + p, 0)
}

export function totalMarks(sections) {
    return (sections || []).reduce((sum, s) => sum + sectionMarks(s), 0)
}

export function questionCount(sections) {
    return (sections || []).reduce((sum, s) => sum + (s.questions || []).length, 0)
}

/**
 * Why this paper cannot be handed up yet, or null when it can.
 *
 * Returned as a key rather than a sentence so the caller translates it, and
 * checked before submitting because the DOS should never open a paper to find
 * out it is empty.
 */
export function whyNotSubmittable(form, sections) {
    if (!form.title.trim())    return 'teacher.exams.needTitle'
    if (!form.subject)         return 'teacher.exams.needSubject'
    if (!form.class_obj)       return 'teacher.exams.needClass'
    if (questionCount(sections) === 0) return 'teacher.exams.needQuestion'
    const overAsked = (sections || []).some(s => {
        const choose = parseInt(s.choose_count) || 0
        return choose > (s.questions || []).length
    })
    if (overAsked) return 'teacher.exams.chooseTooMany'
    return null
}

/** Status → the badge class the portal already uses for that meaning. */
export const STATUS_BADGE = {
    draft:     'badge-soft-muted',
    submitted: 'badge-soft-warning',
    approved:  'badge-soft-success',
    rejected:  'badge-soft-destructive',
}

/**
 * Translation keys, written out rather than assembled from the value.
 *
 * `t(`...status_${s}`)` cannot be grepped, so a key deleted from the bundles
 * looks fine until it renders as its own name on screen. It also collided with
 * i18next's plural suffix: a `type_final` key made it believe a `type` plural
 * family existed, which broke the parity test for every language at once.
 */
export const STATUS_KEY = {
    draft:     'teacher.exams.statusDraft',
    submitted: 'teacher.exams.statusSubmitted',
    approved:  'teacher.exams.statusApproved',
    rejected:  'teacher.exams.statusRejected',
}

export const TYPE_KEY = {
    midterm: 'teacher.exams.typeMidterm',
    final:   'teacher.exams.typeFinal',
    quiz:    'teacher.exams.typeQuiz',
    mock:    'teacher.exams.typeMock',
    other:   'teacher.exams.typeOther',
}

export const TAB_KEY = {
    submitted: 'dos.examPapers.tabSubmitted',
    approved:  'dos.examPapers.tabApproved',
    rejected:  'dos.examPapers.tabRejected',
    draft:     'dos.examPapers.tabDraft',
    all:       'dos.examPapers.tabAll',
}
