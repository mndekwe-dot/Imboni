import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateWithWeekday } from '../../utils/date'
import { MiniCalendar } from './MiniCalendar'
import { VIEWS, VIEW_KEYS, isAtToday, rangeLabel, shadedRange, step } from './timetableNav'

/**
 * Escape and an outside click close a popover, and Escape hands focus back to
 * the button that opened it — the same contract LanguageSwitcher's menu keeps.
 */
function useDismiss(open, setOpen, wrapRef, triggerRef) {
    useEffect(() => {
        if (!open) return
        function onPointer(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
        }
        function onKey(e) {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            setOpen(false)
            triggerRef.current?.focus()
        }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open, setOpen, wrapRef, triggerRef])
}

function viewLabel(t, view) {
    if (view === 'day') return t('common.day')
    if (view === 'schedule') return t('common.schedule')
    if (view === 'month') return t('timetable.month')
    return t('timetable.week')
}

/**
 * Today · ‹ › · the date (opens a month calendar) ········ [ Week ▾ ]
 *
 * Props:
 *   view, onViewChange          'day' | 'week' | 'schedule'
 *   showWeekends, onShowWeekendsChange
 *   anchor                      Date — the day the timetable is on
 *   visibleDays                 day indices on screen (0 = Mon)
 *   now                         Date — school-timezone "now"
 *   onStep(dir), onToday(), onPick(date)
 *   views                       which views the menu offers (default: the
 *                               timetable's three). One view hides the menu.
 *   maxDate                     optional last date that may be shown - a
 *                               register cannot be taken for tomorrow.
 *   children                    trailing content for the row (the legend)
 *
 * Leave onShowWeekendsChange out and the menu has no weekends toggle.
 */
const STEP_TITLES = {
    day:   ['timetable.previousDay', 'timetable.nextDay'],
    month: ['timetable.previousMonth', 'timetable.nextMonth'],
}

export function TimetableToolbar({
    view, onViewChange, showWeekends, onShowWeekendsChange,
    anchor, visibleDays, now, onStep, onToday, onPick, children,
    views = VIEWS, maxDate = null,
}) {
    const { t } = useTranslation()
    const atToday = isAtToday(anchor, view, visibleDays, now)
    const label = rangeLabel(anchor, view, visibleDays, formatDateWithWeekday)

    const [prevKey, nextKey] = STEP_TITLES[view] ?? ['timetable.previousWeek', 'timetable.nextWeek']
    const prevTitle = t(prevKey)
    const nextTitle = t(nextKey)
    /* Past the limit is judged by where a step would land: the first day of
       the next week or month, not the anchor, which may already be the max. */
    const nextRange = shadedRange(step(anchor, view, visibleDays, 1), view, visibleDays)
    const nextStart = nextRange ? nextRange.start : step(anchor, view, visibleDays, 1)
    const atMax = !!maxDate && nextStart > maxDate

    return (
        <div className="tt-toolbar">
            <div className="tt-toolbar-nav">
                <button type="button" className="tt-today-btn" onClick={onToday} disabled={atToday}>
                    {t('common.today')}
                </button>
                <div className="tt-step">
                    <button type="button" className="tt-icon-btn" onClick={() => onStep(-1)}
                        title={prevTitle} aria-label={prevTitle}>
                        <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
                    </button>
                    <button type="button" className="tt-icon-btn" onClick={() => onStep(1)}
                        title={nextTitle} aria-label={nextTitle} disabled={atMax}>
                        <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
                    </button>
                </div>
                <DatePopover
                    label={label}
                    anchor={anchor}
                    range={shadedRange(anchor, view, visibleDays)}
                    today={now}
                    onPick={onPick}
                    maxDate={maxDate}
                />
            </div>

            {children}

            {(views.length > 1 || onShowWeekendsChange) && (
                <ViewMenu
                    views={views}
                    view={view}
                    onViewChange={onViewChange}
                    showWeekends={showWeekends}
                    onShowWeekendsChange={onShowWeekendsChange}
                />
            )}
        </div>
    )
}

function DatePopover({ label, anchor, range, today, onPick, maxDate }) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const wrapRef = useRef(null)
    const triggerRef = useRef(null)
    const panelRef = useRef(null)
    useDismiss(open, setOpen, wrapRef, triggerRef)

    // Opening moves focus onto the selected day, so arrow keys work at once.
    useEffect(() => {
        if (open) panelRef.current?.querySelector('.tt-cal-day[tabindex="0"]')?.focus()
    }, [open])

    return (
        <div className="tt-popover-wrap" ref={wrapRef}>
            <button
                ref={triggerRef}
                type="button"
                className={`tt-date-btn${open ? ' open' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={`${t('timetable.chooseDate')}: ${label}`}
                onClick={() => setOpen(o => !o)}
            >
                <span className="tt-date-label">{label}</span>
                <span className="material-symbols-rounded tt-caret" aria-hidden="true">expand_more</span>
            </button>
            {open && (
                <div className="tt-popover tt-popover--start" role="dialog"
                    aria-label={t('timetable.chooseDate')} ref={panelRef}>
                    <MiniCalendar
                        selected={anchor}
                        range={range}
                        today={today}
                        maxDate={maxDate}
                        onPick={date => { setOpen(false); onPick(date); triggerRef.current?.focus() }}
                    />
                </div>
            )}
        </div>
    )
}

function ViewMenu({ views, view, onViewChange, showWeekends, onShowWeekendsChange }) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const wrapRef = useRef(null)
    const triggerRef = useRef(null)
    const listRef = useRef(null)
    useDismiss(open, setOpen, wrapRef, triggerRef)

    // Open on the current view, like a native select opens on its value.
    useEffect(() => {
        if (open) listRef.current?.querySelector('[aria-checked="true"]')?.focus()
    }, [open])

    /* Up/Down walk the items and wrap; Home/End jump to the ends. */
    function onMenuKey(e) {
        const items = [...(listRef.current?.querySelectorAll('[role^="menuitem"]') ?? [])]
        const at = items.indexOf(document.activeElement)
        const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[e.key]
        if (to === undefined || !items.length) return
        e.preventDefault()
        items[(to + items.length) % items.length].focus()
    }

    return (
        <div className="tt-popover-wrap" ref={wrapRef}>
            <button
                ref={triggerRef}
                type="button"
                className={`tt-view-btn${open ? ' open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${t('timetable.changeView')}: ${viewLabel(t, view)}`}
                onClick={() => setOpen(o => !o)}
            >
                {viewLabel(t, view)}
                <span className="material-symbols-rounded tt-caret" aria-hidden="true">expand_more</span>
            </button>

            {open && (
                <div className="tt-popover tt-popover--end">
                    <ul className="tt-menu" role="menu" aria-label={t('timetable.changeView')}
                        ref={listRef} onKeyDown={onMenuKey}>
                        {views.length > 1 && views.map(v => (
                            <li key={v} role="none">
                                <button
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={view === v}
                                    className={`tt-menu-item${view === v ? ' active' : ''}`}
                                    onClick={() => { onViewChange(v); setOpen(false); triggerRef.current?.focus() }}
                                >
                                    <span className="tt-menu-label">{viewLabel(t, v)}</span>
                                    <kbd className="tt-kbd">{VIEW_KEYS[v]}</kbd>
                                </button>
                            </li>
                        ))}
                        {views.length > 1 && onShowWeekendsChange && (
                            <li role="separator" className="tt-menu-sep" />
                        )}
                        {onShowWeekendsChange && <li role="none">
                            {/* Stays open, as a checkbox in a menu should: you
                                toggle it and look at the grid behind. */}
                            <button
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={showWeekends}
                                className="tt-menu-item"
                                onClick={() => onShowWeekendsChange(!showWeekends)}
                            >
                                <span className="material-symbols-rounded tt-menu-check" aria-hidden="true">
                                    {showWeekends ? 'check' : ''}
                                </span>
                                <span className="tt-menu-label">{t('timetable.showWeekends')}</span>
                            </button>
                        </li>}
                    </ul>
                    <p className="tt-menu-hint">
                        <span>{t('common.today')} <kbd className="tt-kbd">T</kbd></span>
                        <span>{t('common.previous')} <kbd className="tt-kbd">P</kbd></span>
                        <span>{t('common.next')} <kbd className="tt-kbd">N</kbd></span>
                    </p>
                </div>
            )}
        </div>
    )
}
