import { useState,useEffect } from "react";
import { getSchoolSettings } from "../api/dos";

export function useSchoolSettings(){
    const[setting,setSetting]=useState({timezone:'Africa/Kigali', school_name:''})
    const[loading,setLoading]=useState(true)
    const[error,setError]=useState(null)

    useEffect(()=>{
        getSchoolSettings()
            .then(data => setSetting(data))
            .catch(err => setError(err.message))
            .finally(()=> setLoading(false))
    },[])
    return {setting,loading,error}
}
