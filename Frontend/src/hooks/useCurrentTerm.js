import { useState,useEffect } from "react";
import { getCurrentTerm } from "../api/dos";

export function useCurrentTerm(){
    const[ term,setTerm]= useState(null)
    const[loading,setLoading]=useState(true)
    const [error,setError]=useState(null)

    useEffect(()=>{
        getCurrentTerm()
            .then(data => setTerm(data))
            .catch(err => setError(err.message))
            .finally(()=> setLoading(false))
    },[])
     
    return { term , loading, error}
}