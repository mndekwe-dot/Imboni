import { DAY_SHORT } from '../../data/extraTimetable'

/**
 * DayTabs — row of day buttons for mobile timetable navigation.
 *
 * Hidden on desktop via CSS; shown on small screens so the user can
 * switch which day column is visible without horizontal scrolling.
 *
 * Props:
 *   selected  {number}    Day index of the active tab (0 = Mon, 1 = Tue …)
 *   onChange  {function}  Called with the day index of the clicked tab
 *   days      {string[]}  Day label array, indexed by day; defaults to DAY_SHORT
 *   indices   {number[]}  Which days get a tab. Defaults to every label. The
 *                         timetable passes only the days it shows, so the
 *                         academic grid offers no Sunday tab and hiding
 *                         weekends hides Saturday's tab with the column.
 */
export function DayTabs({ selected, onChange, days = DAY_SHORT, indices }) {
    const shown = indices ?? days.map((_, i) => i)
    return (
        <div className="day-tabs">
            {shown.map(index => (
                <button
                    key={days[index]}
                    type="button"
                    className={`day-tab${selected === index ? ' active' : ''}`}
                    aria-pressed={selected === index}
                    onClick={() => onChange(index)}
                >
                    {days[index]}
                </button>
            ))}
        </div>
    )
}
