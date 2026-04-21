import { useState } from 'react'

const STORAGE_KEY = 'imboni_school_config'

const defaultConfig = {
    sections: [
        { name: 'O-Level', years: ['S1', 'S2', 'S3'], classes: ['A', 'B', 'C']              },
        { name: 'A-Level', years: ['S4', 'S5', 'S6'], classes: ['MPG', 'PCB', 'MCB', 'HEG'] },
    ],
}

export function useSchoolConfig() {
    const [config, setConfig] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (!stored) return defaultConfig
            const parsed = JSON.parse(stored)
            // migrate old format: sections was array of strings, now array of objects
            const firstSection = parsed.sections?.[0]
            // migrate: old format had sections as strings or no years inside sections
            if (typeof firstSection === 'string' || (firstSection && !firstSection.years)) {
                localStorage.removeItem(STORAGE_KEY)
                return defaultConfig
            }
            return parsed
        } catch {
            return defaultConfig
        }
    })

    function saveConfig(updated) {
        setConfig(updated)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }

    return { config, saveConfig }
}
