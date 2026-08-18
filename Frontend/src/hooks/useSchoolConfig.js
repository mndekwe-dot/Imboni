import { useEffect, useState } from 'react'
import { getSchoolConfig,updateSchoolConfig } from '../api/dos'


export function useSchoolConfig() {
    const [config,setConfig] = useState([])
    const [loading,setLoading] = useState(true)
    const [error,setError] = useState(null)

    useEffect(()=>{
        getSchoolConfig()
            .then(data => setConfig(data))
            .catch(err => setError(err.message))
            .finally(()=>setLoading(false))
    },[])

    /**
     * Save the structure.
     *
     * Pass `{ confirm: true }` to go through with a save the server has said
     * would remove something (it answers 409 the first time, listing what).
     *
     * Rethrows. It used to swallow the error into state, which meant the
     * caller's catch never ran and a failed save looked exactly like a
     * successful one.
     */
    async function saveConfig(updated, { confirm = false } = {}) {
        try{
            const saved = await updateSchoolConfig(updated, { confirm })
            setConfig(saved)
            setError(null)
            return saved
        } catch (err){
            setError(err.message)
            throw err
        }
    }

    return {config , saveConfig , loading , error}
}
