import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClassFilter } from './ClassFilter'

vi.mock('../../hooks/useSchoolConfig', () => ({
    useSchoolConfig: () => ({
        config: [
            { name: 'A-Level', years: [{ name: 'S4', streams: ['MPC'] }, { name: 'S5', streams: ['MPC', 'PCB'] }] },
            { name: 'O-Level', years: [{ name: 'S1', streams: ['A', 'B'] }] },
        ],
    }),
}))

describe('ClassFilter', () => {
    it('is the Section / Year / Class card the teacher pages use', () => {
        render(<ClassFilter grade="" stream="" onChange={() => {}} />)

        expect(screen.getByLabelText('Section')).toBeInTheDocument()
        expect(screen.getByLabelText('Year')).toBeInTheDocument()
        expect(screen.getByLabelText('Class')).toBeInTheDocument()
    })

    it('offers years in school order whichever section is listed first', () => {
        render(<ClassFilter grade="" stream="" onChange={() => {}} />)

        const years = [...screen.getByLabelText('Year').querySelectorAll('option')].map(o => o.value)
        expect(years).toEqual(['', 'S1', 'S4', 'S5'])
    })

    it('narrows the list to every year of a section chosen on its own', () => {
        const onChange = vi.fn()
        render(<ClassFilter grade="" stream="" onChange={onChange} />)

        fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'A-Level' } })

        expect(onChange).toHaveBeenLastCalledWith({ grade: 'S4,S5', stream: '' })
    })

    it('clears the class when the year changes', () => {
        const onChange = vi.fn()
        render(<ClassFilter grade="S5" stream="PCB" onChange={onChange} />)

        fireEvent.change(screen.getByLabelText('Year'), { target: { value: 'S4' } })

        expect(onChange).toHaveBeenLastCalledWith({ grade: 'S4', stream: '' })
    })
})
