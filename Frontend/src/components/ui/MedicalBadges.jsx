import { useTranslation } from 'react-i18next'

/**
 * The health alerts for one student, as badges.
 *
 * One component so the roll, the dining list and the sick bay show the same
 * thing in the same colour: a nurse scanning a list should not have to learn
 * three ways of saying "epilepsy".
 */
export function MedicalBadges({ flags }) {
    const { t } = useTranslation()
    if (!flags || flags.length === 0) return null
    return (
        <span className="u-row u-wrap">
            {flags.map(f => (
                <span key={f} className="badge badge-soft-destructive" title={t('matron.medical.alert')}>
                    {t(`matron.medical.flags.${f}`)}
                </span>
            ))}
        </span>
    )
}
