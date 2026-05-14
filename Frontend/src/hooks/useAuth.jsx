import { useState } from "react";
import {useNavigate} from 'react-router'
import { loginUser,logoutUser } from "../api/auth";

export function useAuth(){
    const navigate= useNavigate()

    const[user,setUser] = useState(()=>{
        const stored= localStorage.getItem('imboni_user')
        return stored ? JSON.parse(stored): null
    })

    const isAuthenticated = !!localStorage.getItem('imboni_access')

    async function login(email,password,portal,redirectTo) {
        const data = await loginUser(email,password,portal)
        localStorage.setItem('imboni_access',data.access)
        localStorage.setItem('imboni_refresh',data.refresh)
        localStorage.setItem('imboni_user',JSON.stringify(data.user))
        setUser(data.user)
        navigate(redirectTo)
    }
    async function logout(redirectTo ='/login') {
        await logoutUser()
        setUser(null)
        navigate(redirectTo)
    }
    return {user,isAuthenticated,login,logout}
}