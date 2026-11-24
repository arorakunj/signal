import { getAuthToken } from 'deepspace'
import { z } from 'zod'
import { interestsSchema } from './interests'

export async function profileAction(name: 'getInterests' | 'saveInterests', interests?: string[]) {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in to access your interests.')
  const response = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ interests }),
  })
  const result = await response.json() as { success?: boolean; error?: string; data?: unknown }
  const data = interestsSchema.or(z.tuple([])).safeParse(result.data)
  if (!response.ok || !result.success || !data.success) {
    throw new Error(result.error ?? 'Could not access your interests. Try again.')
  }
  return data.data
}
