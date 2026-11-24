import { z } from 'zod'

export const profileDetailsSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  contactEmail: z.string().trim().max(254).pipe(z.email().or(z.literal(''))),
})

export const profileDetailsResponseSchema = profileDetailsSchema.extend({
  displayName: z.string().max(80),
})
export type ProfileDetails = z.infer<typeof profileDetailsSchema>
