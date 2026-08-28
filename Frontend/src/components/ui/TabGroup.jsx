import '../../styles/components.css'

/**
 * TabGroup — the tab bar for every portal.
 *
 * Props:
 *   tabs     [{ key, label, icon?, count? }]  icon and count are optional
 *   value    key of the active tab
 *   onChange (key) => void
 *   label    accessible name for the tab list
 *   idPrefix namespaces the ids when a page has more than one tab bar
 *
 * `count` is the pill on a tab that has work waiting behind it — pending
 * reports, unread threads. Pages that needed one used to hand-roll the whole
 * tab bar rather than the component, which is how the app ended up with three
 * different-looking tab bars; adding the prop was the smaller change. A count
 * of 0 renders nothing: "0 pending" is not news.
 *
 * The ARIA here came from Account's hand-rolled version, which was better
 * than this component: it had role="tablist"/"tab", aria-selected and
 * aria-controls, and this had none of them. The fix was to raise the shared
 * component to match rather than migrate Account down to it.
 *
 * Each button points at `${idPrefix}panel-${key}`, so the matching panel must
 * carry that id and role="tabpanel" for a screen reader to follow the link.
 */
export function TabGroup({ tabs, value, onChange, label, idPrefix = '' }) {
    return (
        <div className="tab-group" role="tablist" aria-label={label}>
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`${idPrefix}tab-${tab.key}`}
                    aria-selected={value === tab.key}
                    aria-controls={`${idPrefix}panel-${tab.key}`}
                    className={`tab-btn${value === tab.key ? ' active' : ''}`}
                    onClick={() => onChange(tab.key)}>
                    {tab.icon && (
                        <span className="material-symbols-rounded tab-icon" aria-hidden="true">{tab.icon}</span>
                    )}
                    {tab.label}
                    {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
                </button>
            ))}
        </div>
    )
}
