import { AuthOverlay, useAuthStatus } from 'deepspace'
import { Navigate, useNavigate } from 'react-router-dom'

export default function SignIn() {
  const { isSignedIn } = useAuthStatus()
  const navigate = useNavigate()

  if (isSignedIn) return <Navigate to="/feed" replace />

  return (
    <AuthOverlay
      title="Sign in to Signal"
      description="New to Signal? Continue with Google or GitHub to create your account. Returning readers can use the same provider to sign in."
      onClose={() => navigate('/')}
    />
  )
}
