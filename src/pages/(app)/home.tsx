import { useAuthStatus } from 'deepspace'
import { Navigate } from 'react-router-dom'

// DeepSpace returns to this route after social sign-in.
export default function Home() {
  const { isSignedIn } = useAuthStatus()
  return <Navigate to={isSignedIn ? '/feed' : '/sign-in'} replace />
}
