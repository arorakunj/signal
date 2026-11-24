import { AuthGate } from 'deepspace'
import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedLayout() {
  return (
    <AuthGate fallback={<Navigate to="/sign-in" replace />} redirectOnSignOut="/sign-in">
      <Outlet />
    </AuthGate>
  )
}
