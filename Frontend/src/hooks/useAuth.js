import { useState } from "react";
import {useNavigate} from 'react-router'
import { loginUser,logoutUser, verifyTwoFactorLogin } from "../api/auth";

export function useAuth(){
    const navigate= useNavigate()

    const[user,setUser] = useState(()=>{
        const stored= localStorage.getItem('imboni_user')
        return stored ? JSON.parse(stored): null
    })

    const isAuthenticated = !!localStorage.getItem('imboni_access')

    function persistSession(data, redirectTo) {
        localStorage.setItem('imboni_access',data.access)
        localStorage.setItem('imboni_refresh',data.refresh)
        localStorage.setItem('imboni_user',JSON.stringify(data.user))
        setUser(data.user)
        navigate(redirectTo)
    }

    async function login(email,password,portal,redirectTo) {
        const data = await loginUser(email,password,portal)
        // 2FA account: password verified, but tokens are withheld until the
        // second step. Hand the challenge back so the page can prompt for a code.
        if (data.requires_2fa) {
            return { requires2fa: true, challenge: data.challenge, redirectTo }
        }
        persistSession(data, redirectTo)
        return { requires2fa: false }
    }

    async function completeTwoFactor(challenge, code, redirectTo) {
        const data = await verifyTwoFactorLogin(challenge, code)
        persistSession(data, redirectTo)
    }

    async function logout(redirectTo ='/login') {
        await logoutUser()
        setUser(null)
        navigate(redirectTo)
    }
    return {user,isAuthenticated,login,completeTwoFactor,logout}
}