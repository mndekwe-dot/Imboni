/**
 * Converts school config sections into a flat list of class names.
 * e.g. [{name:'O-Level', years:[{name:'S1', streams:['A','B']}]}]
 *      → ['S1A', 'S1B', ...]
 */
export function classesFromConfig(sections = []) {
    return sections.flatMap(sec =>
        sec.years.flatMap(year =>
            year.streams.map(stream => `${year.name}${stream}`)
        )
    )
}

/**
 * Returns unique year names from school config.
 * e.g. ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
 */
export function yearsFromConfig(sections = []) {
    return [...new Set(sections.flatMap(sec => sec.years.map(y => y.name)))]
}
