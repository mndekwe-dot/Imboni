import { DAY_SHORT } from '../../data/extraTimetable'

/**
 * DayTabs — row of day buttons for mobile timetable navigation.
 *
 * Hidden on desktop via CSS; shown on small screens so the user can
 * switch which day column is visible without horizontal scrolling.
 *
 * Props:
 *   selected  {number}    Index of the active day (0 = Mon, 1 = Tue …)
 *   onChange  {function}  Called with the new day index when a tab is clicked
 *   days      {string[]}  Day label array; defaults to DAY_SHORT from extraTimetable
 */
export function DayTabs({ selected, onChange, days = DAY_SHORT }) {
    return (
        <div className="day-tabs">
            {days.map((day, index) => (
                <button
                    key={day}
                    className={`day-tab${selected === index ? ' active' : ''}`}
                    onClick={() => onChange(index)}
                >
                    {day}
                </button>
            ))}
        </div>
    )
}
