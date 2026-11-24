import { useAuthStatus } from 'deepspace'
import { Navigate, useSearchParams } from 'react-router-dom'

// DeepSpace returns here after exchanging the OAuth code for a session.
export default function Home() {
  const { isSignedIn } = useAuthStatus()
  const [params] = useSearchParams()
  const completedSignIn = params.get('auth') === 'complete'

  if (!isSignedIn) {
    return <Navigate to={completedSignIn ? '/sign-in?error=session' : '/sign-in'} replace />
  }

  return <Navigate to={completedSignIn ? '/feed?review-interests=1' : '/feed'} replace />
}
