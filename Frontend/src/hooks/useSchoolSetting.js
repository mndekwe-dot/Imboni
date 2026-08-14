import { useState,useEffect } from "react";
import { getSchoolSettings } from "../api/dos";

export function useSchoolSettings(){
    // `terms` describes how this school divides its academic year. The default
    // mirrors the backend's, so a school that has configured nothing still gets
    // the familiar three terms.
    const[setting,setSetting]=useState({
        timezone:'Africa/Kigali',
        school_name:'',
        terms:[
            {code:'term1', label:'Term 1', order:1},
            {code:'term2', label:'Term 2', order:2},
            {code:'term3', label:'Term 3', order:3},
        ],
    })
    const[loading,setLoading]=useState(true)
    const[error,setError]=useState(null)

    useEffect(()=>{
        getSchoolSettings()
            .then(data => setSetting(s => ({...s, ...data, terms: data.terms?.length ? data.terms : s.terms})))
            .catch(err => setError(err.message))
            .finally(()=> setLoading(false))
    },[])
    return {setting,loading,error}
}
