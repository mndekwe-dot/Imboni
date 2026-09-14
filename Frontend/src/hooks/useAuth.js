import { useState } from "react";
import {useNavigate} from 'react-router'
import { loginUser,logoutUser, verifyTwoFactorLogin } from "../api/auth";
import { ROLE_HOME } from "../utils/roles";
import { resetSchoolConfigCache } from "./schoolConfigCache";
import { resetLibraryFeatureCache } from './libraryFeatureCache'
import { resetFinanceFeatureCache } from './financeFeatureCache'


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
        // Explicit redirect (portal logins) wins; otherwise send the user to
        // their role's home so the generic /login always lands somewhere real.
        //
        // `replace`, so the login form does not stay in history underneath the
        // portal. Otherwise Back from /student returns to /login/student while
        // still signed in, and after logout the portal's login URL is still
        // sitting in the history to step back into.
        navigate(redirectTo || ROLE_HOME[data.user?.role] || '/', { replace: true })
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
        try {
            await logoutUser()
        } catch (e) {
            // logoutUser has already cleared this browser's session by the time
            // it throws, so the user IS signed out — the only thing that failed
            // is revoking the refresh token on the server, which expires on its
            // own. Nothing for the user to act on, so it is logged, not shown.
            console.warn('Signed out locally; server-side token revoke failed:', e)
        }
        setUser(null)
        // The school's structure is cached at module scope for the session.
        // It belongs to the school that was signed in, not to the browser —
        // on a shared office machine the next sign-in could be another school
        // (or another tenant), and it must not inherit these year and stream
        // lists in its class pickers.
        resetSchoolConfigCache()
        // Same reasoning for the plan: whether the library is switched on
        // belongs to the school, and the next school to sign in here may be on
        // a different plan.
        resetLibraryFeatureCache()
        resetFinanceFeatureCache()
        // Every role signs out to the generic /login, never back to its own
        // /login/<portal>, and `replace` takes the portal page out of history
        // so Back does not step into a portal URL after signing out. Same
        // behaviour the platform console already had (PlatformLayout).
        navigate(redirectTo, { replace: true })
    }
    return {user,isAuthenticated,login,completeTwoFactor,logout}
}