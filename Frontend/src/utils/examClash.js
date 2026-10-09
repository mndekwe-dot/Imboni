/**
 * Saving an exam the server says clashes with another.
 *
 * The server refuses a clashing paper with 409 and the list of problems, so a
 * clash is a decision made on purpose rather than something that slips in. The
 * DOS sees what clashes and may still go ahead - two papers can legitimately
 * share a hall - in which case the request is sent again, acknowledged.
 */
import { confirmDialog } from './confirm'

export function clashLines(conflicts = [], t) {
    return conflicts
        .map(c => t(`dos.examSchedule.clash.${c.type}`, {
            with: (c.with || []).join(', '), needed: c.needed, seats: c.seats,
        }))
        .join('\n')
}

/**
 * @param send  (extra) => Promise - performs the request, merging `extra` into its body
 * @returns the response, or null when the user chose not to save a clashing paper
 */
export async function saveWithClashCheck(send, t) {
    try {
        return await send({})
    } catch (e) {
        const conflicts = e?.response?.status === 409 ? e.response.data?.conflicts : null
        if (!conflicts) throw e
        const ok = await confirmDialog(t('dos.examSchedule.clashConfirm', { details: clashLines(conflicts, t) }))
        return ok ? send({ acknowledge_conflicts: true }) : null
    }
}
