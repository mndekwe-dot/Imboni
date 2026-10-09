import { useEffect } from 'react'
import { useSchoolBranding } from './useSchoolBranding'

const DEFAULT_TITLE = 'Imboni'

/**
 * The browser tab says whose school this is.
 *
 * A teacher with three tabs open, or a parent whose child is at one school and
 * who works at another, finds the right one by its title and icon. Without
 * this every tab on every school reads "Imboni". The school's name replaces
 * the title and its logo the favicon; with neither set the product's own stay.
 *
 * Call it once per screen that shows the school's chrome (the sidebar and the
 * sign-in pages already do). It puts the original back on unmount.
 */
export function useBrandedTab() {
    const { schoolName, logo } = useSchoolBranding()

    useEffect(() => {
        if (!schoolName) return
        const previous = document.title
        document.title = schoolName
        return () => { document.title = previous || DEFAULT_TITLE }
    }, [schoolName])

    useEffect(() => {
        if (!logo) return
        const link = document.querySelector('link[rel~="icon"]')
        if (!link) return
        const previous = link.getAttribute('href')
        link.setAttribute('href', logo)
        return () => { if (previous) link.setAttribute('href', previous) }
    }, [logo])
}
