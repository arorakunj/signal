import { useState } from 'react'
import { AuthOverlay, useAuthStatus } from 'deepspace'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

export default function SignIn() {
  const { isSignedIn } = useAuthStatus()
  const [startedSignedOut] = useState(!isSignedIn)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const error = params.get('error')
  const description = error === 'session'
    ? 'Your browser didn’t keep the sign-in session. Allow cookies for this site and try again.'
    : error === 'oauth'
      ? 'Sign-in didn’t finish. Please try Google or GitHub again.'
      : 'New to Signal? Continue with Google or GitHub to create your account. Returning readers can use the same provider to sign in.'

  if (isSignedIn) return <Navigate to={startedSignedOut ? '/feed?review-interests=1' : '/feed'} replace />

  return (
    <AuthOverlay
      title="Sign in to Signal"
      description={description}
      onClose={() => navigate('/')}
    />
  )
}
