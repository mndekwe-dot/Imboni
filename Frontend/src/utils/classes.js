/**
 * Helpers for the school's own structure — which year levels it teaches and
 * which streams each year has.
 *
 * The backend now stores the school's own year code ('S1', 'P4', 'Y9') in
 * `grade`, so there is nothing to prefix and nothing to parse. These helpers
 * replace roughly forty `` `S${grade}${section}` `` template literals and the
 * `.replace('S', '')` calls that undid them — string surgery that only ever
 * worked for a Rwandan secondary school.
 */

/**
 * Converts school config sections into a flat list of class names.
 * e.g. [{name:'O-Level', years:[{name:'S1', streams:['A','B']}]}]
 *      → ['S1A', 'S1B', ...]
 */
export function classesFromConfig(sections = []) {
    return sections.flatMap(sec =>
        (sec.years ?? []).flatMap(year =>
            (year.streams ?? sec.streams ?? []).map(stream => `${year.name}${stream}`)
        )
    )
}

/**
 * Returns unique year names from school config, in teaching order.
 * e.g. ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
 */
export function yearsFromConfig(sections = []) {
    return [...new Set(sections.flatMap(sec => (sec.years ?? []).map(y => y.name)))]
}

/**
 * The streams configured for one year, e.g. streamsForYear(config, 'S4').
 * Streams are per-year: an A-Level combination is not a stream in S1.
 */
export function streamsForYear(sections = [], year) {
    for (const sec of sections) {
        for (const y of sec.years ?? []) {
            if (y.name === year) return y.streams ?? sec.streams ?? []
        }
    }
    return []
}

/** Every stream used anywhere in the school, deduplicated. */
export function allStreams(sections = []) {
    return [...new Set(
        sections.flatMap(sec =>
            (sec.years ?? []).flatMap(y => y.streams ?? sec.streams ?? [])
        )
    )]
}

/**
 * How a class is written for a human.
 *
 * Prefers the class's own name, which a school can edit; falls back to the year
 * code and stream joined together. The year code says what it is, so no 'S' or
 * 'Grade ' is added here — doing that produced 'SS3' and 'Grade S3A'.
 *
 *   classLabel('S3', 'A')                       → 'S3A'
 *   classLabel(c.grade, c.section, c.name)      → the class's name when it has one
 */
export function classLabel(grade, section, name) {
    const own = (name ?? '').trim()
    if (own) return own
    return `${grade ?? ''}${section ?? ''}`.trim()
}

/** A year on its own, e.g. for 'all classes in S3'. */
export function yearLabel(grade) {
    return grade == null ? '' : String(grade)
}

/**
 * Group a teacher's (or the school's) classes into the sections the school has
 * configured, for the section → year → stream pickers.
 *
 * Five pages each carried their own copy of this, and every copy guessed:
 * `parseInt(cls.grade) <= 3 ? 'O-Level' : 'A-Level'`. That is the Rwandan
 * secondary structure written into the UI — it mislabels a primary school and
 * produces NaN now that a year code is 'S1' rather than '1'. The school's own
 * configuration says which section a year belongs to; when a year is not in the
 * configuration it falls into a single unnamed group rather than a wrong one.
 */
export function sectionsFromClasses(classes = [], config = []) {
    const sectionOf = new Map()
    for (const sec of config) {
        for (const y of sec.years ?? []) sectionOf.set(y.name, sec.name)
    }

    const order = []
    const map = new Map()
    for (const cls of classes) {
        const secName = sectionOf.get(cls.grade) ?? 'Classes'
        if (!map.has(secName)) { map.set(secName, new Map()); order.push(secName) }
        const years = map.get(secName)
        if (!years.has(cls.grade)) years.set(cls.grade, [])
        const streams = years.get(cls.grade)
        if (cls.section && !streams.includes(cls.section)) streams.push(cls.section)
    }

    // Years keep configuration order where the config knows them; anything the
    // config does not list follows, in the order the classes arrived.
    const configOrder = yearsFromConfig(config)
    const rank = y => {
        const i = configOrder.indexOf(y)
        return i === -1 ? configOrder.length : i
    }

    return order.map(name => ({
        name,
        years: [...map.get(name).entries()]
            .sort(([a], [b]) => rank(a) - rank(b))
            .map(([yName, streams]) => ({ name: yName, streams: [...streams].sort() })),
    }))
}
