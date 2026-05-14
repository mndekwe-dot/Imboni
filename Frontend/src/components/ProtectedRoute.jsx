import { Navigate } from "react-router";

export function ProtectedRoute({children}){
    const token = localStorage.getItem('imboni_access')

    if(!token){
        return <Navigate to="/login" replace/>
    }
    return children
}