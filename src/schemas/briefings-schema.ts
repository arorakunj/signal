import type { CollectionSchema } from 'deepspace/schema'
import { profilesSchema } from './profiles-schema'

// One private snapshot per reader. Only authenticated server actions expose it.
export const briefingsSchema: CollectionSchema = {
  name: 'briefings',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain' },
    { name: 'report', storage: 'text', interpretation: 'plain' },
    { name: 'podcast', storage: 'text', interpretation: 'plain' },
  ],
  permissions: profilesSchema.permissions,
}
