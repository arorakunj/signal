import { RECORD_NOT_FOUND, type ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { interestsSchema } from '../lib/interests'

export const actions: Record<string, ActionHandler<Env>> = {
  getInterests: async ({ tools, userId }) => {
    const result = await tools.get<{ interests: string }>('profiles', userId)
    if (!result.success) {
      if (result.error === RECORD_NOT_FOUND) return { success: true, data: [] }
      return { success: false, error: 'Could not load your interests.' }
    }
    return { success: true, data: JSON.parse(result.data.record.data.interests) }
  },
  saveInterests: async ({ tools, userId, params }) => {
    const interests = interestsSchema.safeParse(params.interests)
    if (!interests.success) {
      return { success: false, error: 'Choose 1–16 interests of up to 80 characters each.' }
    }
    const result = await tools.create('profiles', {
      interests: JSON.stringify(interests.data),
    }, userId)
    if (!result.success) return { success: false, error: 'Could not save your interests.' }
    return { success: true, data: interests.data }
  },
}
