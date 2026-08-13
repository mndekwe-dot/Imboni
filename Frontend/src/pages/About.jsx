import { Link } from 'react-router'
import { PublicLayout } from '../components/PublicLayout'

const VALUES = [
    {
        icon: 'shield_person',
        title: 'Children first',
        body: 'This system holds minors\' grades, medical notes and disciplinary records. '
            + 'Every design decision starts from that, not from what is convenient to build.',
    },
    {
        icon: 'signal_disconnected',
        title: 'Built for real connectivity',
        body: 'Registers, medication rounds and night checks are recorded offline and sync '
            + 'when the connection returns. A dropped network should never mean a lost register.',
    },
    {
        icon: 'schedule',
        title: 'Give time back',
        body: 'Timetables, exam schedules, duty rosters and dormitory allocation are generated '
            + 'rather than assembled by hand. That is days returned to every term.',
    },
    {
        icon: 'lock',
        title: 'Separate by default',
        body: 'Each school gets its own isolated database schema. One school can never see '
            + 'another\'s records, because the data is not in the same tables.',
    },
]

export function About() {
    return (
        <PublicLayout
            title="About Imboni"
            subtitle="School management software built specifically for Rwandan secondary schools."
        >
            <div className="pub-prose">
                <h2>Why we built it</h2>
                <p>
                    Most Rwandan secondary schools run on paper and spreadsheets. A class
                    timetable takes days to build and breaks the moment one teacher changes.
                    Marks travel from teacher to Director of Studies on paper and get queried,
                    recopied, or lost. Attendance sits in registers nobody can total until the
                    end of term. Boarding, medical and conduct records live in three different
                    books.
                </p>
                <p>
                    None of that is a technology problem in the abstract. It is a specific set
                    of jobs that specific people do every week, and it is entirely automatable.
                    Imboni exists to do that automating without asking a school to change how
                    it already works.
                </p>

                <h2>What makes it different</h2>
                <p>
                    Imboni is built around the structure of a Rwandan secondary school rather
                    than adapted from a generic product. O-Level and A-Level sections, streams,
                    three terms, continuous assessment out of 30 and examinations out of 70,
                    boarding and day scholars, matrons and Directors of Discipline: these are
                    first-class parts of the system, not custom fields bolted onto something
                    designed elsewhere.
                </p>
            </div>

            <div className="pub-values">
                {VALUES.map(value => (
                    <div className="pub-value" key={value.title}>
                        <span className="material-symbols-rounded" aria-hidden="true">
                            {value.icon}
                        </span>
                        <h3>{value.title}</h3>
                        <p>{value.body}</p>
                    </div>
                ))}
            </div>

            <div className="pub-prose">
                <h2>Where we are</h2>
                <p>
                    Imboni is developed in Musanze, Northern Province, Rwanda. We work directly
                    with the schools using the system, and the roadmap is shaped by what they
                    ask for rather than by what looks impressive in a demo.
                </p>

                <h2>Talk to us</h2>
                <p>
                    If you run a school and want to see the system loaded with your own classes
                    and subjects, <Link to="/contact">get in touch</Link>. If you would rather
                    try it yourself first, the <Link to="/pricing">Free plan</Link> is the full
                    system and takes a few minutes to set up.
                </p>
            </div>
        </PublicLayout>
    )
}
