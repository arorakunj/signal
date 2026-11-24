import { RECORD_NOT_FOUND, type ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { interestsSchema } from '../lib/interests'
import { readStored } from '../lib/briefing'
import { deleteSignalAccount, getProfileDetails, saveProfileDetails } from './account'
import { getBriefing, startBriefing } from './briefings'

export const actions: Record<string, ActionHandler<Env>> = {
  deleteSignalAccount,
  getProfileDetails,
  saveProfileDetails,
  getBriefing,
  startBriefing,
  getInterests: async ({ tools, userId }) => {
    const result = await tools.get<{ interests: string }>('profiles', userId)
    if (!result.success) {
      if (result.error === RECORD_NOT_FOUND) return { success: true, data: [] }
      return { success: false, error: 'Could not load your interests.' }
    }
    const stored = result.data.record.data.interests
    if (!stored) return { success: true, data: [] }
    const interests = readStored(interestsSchema, stored)
    return interests
      ? { success: true, data: interests }
      : { success: false, error: 'Could not read your saved interests.' }
  },
  saveInterests: async ({ tools, userId, params }) => {
    const interests = interestsSchema.safeParse(params.interests)
    if (!interests.success) {
      return { success: false, error: 'Choose at least one category. Each specific interest must be 80 characters or fewer.' }
    }
    const result = await tools.create('profiles', {
      interests: JSON.stringify(interests.data),
    }, userId)
    if (!result.success) return { success: false, error: 'Could not save your interests.' }
    return { success: true, data: interests.data }
  },
}
