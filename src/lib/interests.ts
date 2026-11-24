import { z } from 'zod'

export const topics = [
  'Artificial intelligence', 'Technology', 'Science', 'Space', 'Business',
  'Startups', 'Finance', 'Sports', 'Gaming', 'Music', 'Entertainment',
  'Career opportunities',
]

export const interestsSchema = z.array(z.string().trim().min(1).max(80)).min(1).max(16)
  .transform((items) => [...new Map(items.map((item) => [item.toLowerCase(), item])).values()])
