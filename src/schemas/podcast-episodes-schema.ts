import type { CollectionSchema } from 'deepspace/schema'
import { profilesSchema } from './profiles-schema'

export const podcastEpisodesSchema: CollectionSchema = {
  name: 'podcastEpisodes',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain' },
    { name: 'jobId', storage: 'text', interpretation: 'plain' },
    { name: 'month', storage: 'text', interpretation: 'plain' },
    { name: 'publishedAt', storage: 'text', interpretation: 'plain' },
    { name: 'podcast', storage: 'text', interpretation: 'plain' },
  ],
  permissions: profilesSchema.permissions,
}
