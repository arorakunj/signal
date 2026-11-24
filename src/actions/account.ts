import { RECORD_NOT_FOUND, type ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { profileDetailsSchema } from '../lib/profile-details'

type ProfileFields = { displayName?: string; contactEmail?: string }

export const getProfileDetails: ActionHandler<Env> = async ({ tools, userId }) => {
  const result = await tools.get<ProfileFields>('profiles', userId)
  if (!result.success && result.error !== RECORD_NOT_FOUND) {
    return { success: false, error: 'Could not load your profile.' }
  }
  const profile = result.success ? result.data.record.data : {}
  return {
    success: true,
    data: { displayName: profile.displayName ?? '', contactEmail: profile.contactEmail ?? '' },
  }
}

export const saveProfileDetails: ActionHandler<Env> = async ({ tools, userId, params }) => {
  const details = profileDetailsSchema.safeParse(params)
  if (!details.success) return { success: false, error: 'Enter a display name and a valid contact email, or leave the email blank.' }
  const saved = await tools.create('profiles', details.data, userId)
  return saved.success
    ? { success: true, data: details.data }
    : { success: false, error: 'Could not save your profile.' }
}

export const deleteSignalAccount: ActionHandler<Env> = async ({ env, params, userId }) => {
  if (params.confirmation !== 'DELETE') return { success: false, error: 'Type DELETE to confirm.' }
  const stub = env.JOB_ROOMS.get(env.JOB_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const result = await stub.fetch('https://internal/signal-account-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  return result.json<Awaited<ReturnType<ActionHandler<Env>>>>()
}
