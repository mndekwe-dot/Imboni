import { addWeeks, subWeeks } from 'date-fns'
import { getThisMonday, formatWeekLabel, isThisWeek } from './dateUtils'

export function WeekPicker({ currentMonday, onChange }) {
    function prev() { onChange(subWeeks(currentMonday, 1)) }
    function next() { onChange(addWeeks(currentMonday, 1)) }
    function today() { onChange(getThisMonday()) }
    const isCurrentWeek = isThisWeek(currentMonday)
    return (
        <div className="week-picker">
            <button className="week-picker-btn" onClick={prev} title="Previous week">
                <span className="material-symbols-rounded">chevron_left</span>
            </button>
            <span className="week-picker-label">
                {formatWeekLabel(currentMonday)}
            </span>
            <button className="week-picker-btn" onClick={next} title="Next week">
                <span className="material-symbols-rounded">chevron_right</span>
            </button>
            {/* Only show Today button when not already on the current week */}
            {!isCurrentWeek && (
                <button className="week-picker-today" onClick={today}>Today</button>
            )}
        </div>
    )
}