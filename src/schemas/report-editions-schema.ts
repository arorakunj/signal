import type { CollectionSchema } from 'deepspace/schema'
import { profilesSchema } from './profiles-schema'

export const reportEditionsSchema: CollectionSchema = {
  name: 'reportEditions',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain' },
    { name: 'edition', storage: 'text', interpretation: 'plain' },
    { name: 'month', storage: 'text', interpretation: 'plain' },
    { name: 'report', storage: 'text', interpretation: 'plain' },
  ],
  permissions: profilesSchema.permissions,
}
