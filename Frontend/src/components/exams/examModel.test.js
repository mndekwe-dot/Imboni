import { describe, it, expect } from 'vitest'
import {
  sectionMarks, totalMarks, questionCount, whyNotSubmittable,
  questionMarks, newPart, newExamQuestion, ANSWER_SPACES,
} from './examModel'

/**
 * The arithmetic a paper turns on.
 *
 * "Answer any three of six" is the rule that makes an exam paper different
 * from a longer quiz, and it is the one most easily got wrong: counting every
 * question would overstate what the paper is out of, and every percentage
 * taken from it afterwards would be wrong by the same margin. The server
 * computes this independently, so both sides are pinned to the same answer.
 */

const q = (points) => ({ id: String(Math.random()), type: 'structured', text: 'Q', points })

describe('sectionMarks', () => {
  it('sums every question when the section is compulsory', () => {
    expect(sectionMarks({ choose_count: 0, questions: [q(5), q(5), q(10)] })).toBe(20)
  })

  it('counts only the questions a candidate must answer', () => {
    expect(sectionMarks({ choose_count: 3, questions: [q(15), q(15), q(15), q(15), q(15), q(15)] }))
      .toBe(45)
  })

  it('takes the highest-scoring questions, since that is the most obtainable', () => {
    expect(sectionMarks({ choose_count: 2, questions: [q(5), q(20), q(10)] })).toBe(30)
  })

  it('ignores a choose_count larger than the section, rather than inventing marks', () => {
    expect(sectionMarks({ choose_count: 9, questions: [q(4), q(6)] })).toBe(10)
  })

  it('handles an empty section', () => {
    expect(sectionMarks({ choose_count: 0, questions: [] })).toBe(0)
  })

  it('treats a missing points value as zero rather than NaN', () => {
    expect(sectionMarks({ choose_count: 0, questions: [{ points: undefined }, q(7)] })).toBe(7)
  })
})

describe('totalMarks', () => {
  it('adds the sections together', () => {
    expect(totalMarks([
      { choose_count: 0, questions: [q(10), q(10)] },   // 20
      { choose_count: 1, questions: [q(30), q(30)] },   // 30
    ])).toBe(50)
  })

  it('is zero for a paper with nothing on it', () => {
    expect(totalMarks([])).toBe(0)
    expect(totalMarks(undefined)).toBe(0)
  })
})

describe('questionCount', () => {
  it('counts every question, including ones a candidate may skip', () => {
    expect(questionCount([{ choose_count: 1, questions: [q(5), q(5), q(5)] }])).toBe(3)
  })
})

describe('whyNotSubmittable', () => {
  const ok = { title: 'Biology', subject: 's1', class_obj: 'c1' }
  const oneQuestion = [{ choose_count: 0, questions: [q(5)] }]

  it('passes a complete paper', () => {
    expect(whyNotSubmittable(ok, oneQuestion)).toBeNull()
  })

  it('names the missing title', () => {
    expect(whyNotSubmittable({ ...ok, title: '  ' }, oneQuestion))
      .toBe('teacher.exams.needTitle')
  })

  it('names the missing subject', () => {
    expect(whyNotSubmittable({ ...ok, subject: '' }, oneQuestion))
      .toBe('teacher.exams.needSubject')
  })

  it('names the missing class', () => {
    expect(whyNotSubmittable({ ...ok, class_obj: '' }, oneQuestion))
      .toBe('teacher.exams.needClass')
  })

  it('refuses an empty paper, so the DOS never opens one to find out', () => {
    expect(whyNotSubmittable(ok, [{ choose_count: 0, questions: [] }]))
      .toBe('teacher.exams.needQuestion')
  })

  it('refuses a section that asks for more than it offers', () => {
    expect(whyNotSubmittable(ok, [{ choose_count: 4, questions: [q(5)] }]))
      .toBe('teacher.exams.chooseTooMany')
  })

  /* Returned as a key, not a sentence, so the caller translates it. */
  it('returns a translation key rather than a message', () => {
    expect(whyNotSubmittable({ ...ok, title: '' }, oneQuestion)).toMatch(/^teacher\.exams\./)
  })
})

/**
 * Sub-questions. A structured question carries its marks on its parts, and the
 * server rolls them up the same way — these pin the client half so the running
 * total a teacher sees while writing cannot drift from the printed paper.
 */
describe('questionMarks', () => {
  const part = (points) => ({ ...newPart(), points })

  it('uses the stem points when there are no parts', () => {
    expect(questionMarks({ points: 7, parts: [] })).toBe(7)
  })

  it('sums the parts when there are any', () => {
    expect(questionMarks({ points: 0, parts: [part(2), part(3)] })).toBe(5)
  })

  it('ignores the stem points once parts exist, so the two cannot disagree', () => {
    expect(questionMarks({ points: 99, parts: [part(4)] })).toBe(4)
  })

  it('treats a blank part mark as zero rather than NaN', () => {
    expect(questionMarks({ points: 0, parts: [{ points: '' }, part(3)] })).toBe(3)
  })
})

describe('section and paper totals with parts', () => {
  const structured = (...points) => ({
    id: String(Math.random()), type: 'structured', text: 'Q', points: 0,
    parts: points.map(p => ({ ...newPart(), points: p })),
  })

  it('rolls part marks up through the section', () => {
    expect(sectionMarks({ choose_count: 0, questions: [structured(2, 3), structured(5)] }))
      .toBe(10)
  })

  it('composes with choose_count, picking the best structured questions', () => {
    expect(sectionMarks({ choose_count: 2, questions: [structured(5), structured(20), structured(10)] }))
      .toBe(30)
  })

  it('counts a structured question as one question, not one per part', () => {
    expect(questionCount([{ choose_count: 0, questions: [structured(1, 1, 1)] }])).toBe(1)
  })

  it('adds sections that mix structured and plain questions', () => {
    expect(totalMarks([
      { choose_count: 0, questions: [structured(4, 6)] },
      { choose_count: 0, questions: [{ points: 10, parts: [] }] },
    ])).toBe(20)
  })
})

describe('newExamQuestion', () => {
  it('starts with the fields a printed question needs', () => {
    const q = newExamQuestion()
    expect(q.parts).toEqual([])
    expect(q.answer_space).toBe('lines')
    expect(q.pairs).toEqual([])
    expect(typeof q.code).toBe('string')
  })

  it('defaults to a written question, since that is the common case on paper', () => {
    expect(newExamQuestion().type).toBe('structured')
  })
})

describe('ANSWER_SPACES', () => {
  it('covers written, calculated, graphed and none', () => {
    expect(ANSWER_SPACES.map(s => s.value)).toEqual(['lines', 'working', 'grid', 'none'])
  })
})
