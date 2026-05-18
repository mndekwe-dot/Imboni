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

    async function saveConfig(updated) {
        try{
            const saved = await updateSchoolConfig(updated)
            setConfig(saved)
        } catch (err){
            setError(err.message)
        }
    }

    return {config , saveConfig , loading , error}
}
