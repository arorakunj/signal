import { getAuthToken } from 'deepspace'
import { interestsResponseSchema, type Interest } from './interests'
import { profileDetailsResponseSchema, type ProfileDetails } from './profile-details'

async function requestAccountAction(name: string, params: object) {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in to access your interests.')
  const response = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const result = await response.json() as { success?: boolean; error?: string; data?: unknown }
  if (!response.ok || !result.success) {
    throw new Error(result.error ?? 'Could not update your account. Try again.')
  }
  return result.data
}

export async function profileAction(name: 'getInterests' | 'saveInterests', interests?: Interest[]) {
  return interestsResponseSchema.parse(await requestAccountAction(name, { interests }))
}

export async function getProfileDetails() {
  return profileDetailsResponseSchema.parse(await requestAccountAction('getProfileDetails', {}))
}

export const PROFILE_UPDATED = 'signal:profile-updated'

export async function saveProfileDetails(details: ProfileDetails) {
  const saved = profileDetailsResponseSchema.parse(await requestAccountAction('saveProfileDetails', details))
  window.dispatchEvent(new Event(PROFILE_UPDATED))
  return saved
}

export async function deleteSignalAccount(confirmation: string) {
  await requestAccountAction('deleteSignalAccount', { confirmation })
}
