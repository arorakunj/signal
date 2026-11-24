import type { CollectionSchema } from 'deepspace/schema'

export const profilesSchema: CollectionSchema = {
  name: 'profiles',
  columns: [{ name: 'interests', storage: 'text', interpretation: 'plain' }],
  // Profile access is through actions keyed by the verified caller.
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
