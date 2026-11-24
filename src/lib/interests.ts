import { z } from 'zod'

export const categories = [
  'Science', 'Technology', 'Music', 'Entertainment', 'Sports',
  'Business', 'Finance', 'Gaming', 'Careers', 'Other interests',
] as const

export const categorySchema = z.enum(categories)
export type Category = z.infer<typeof categorySchema>

export const interestSchema = z.object({
  category: categorySchema,
  focus: z.array(z.string().trim().min(1).max(80)).max(16)
    .transform((items) => [...new Map(items.map((item) => [item.toLowerCase(), item])).values()]),
})
export type Interest = z.infer<typeof interestSchema>

const structured = z.array(interestSchema).min(1).max(categories.length)
  .refine((items) => new Set(items.map(({ category }) => category)).size === items.length)

const legacy = z.array(z.string().trim().min(1).max(80)).min(1).max(16).transform((items): Interest[] => {
  const known: Record<string, Category> = {
    'Artificial intelligence': 'Technology',
    Space: 'Science',
    Startups: 'Business',
    'Career opportunities': 'Careers',
  }
  const merged = new Map<Category, Interest>()
  const custom: string[] = []

  function add(category: Category, term?: string) {
    const entry = merged.get(category) ?? { category, focus: [] }
    if (term && !entry.focus.some((focus) => focus.toLowerCase() === term.toLowerCase())) {
      entry.focus.push(term)
    }
    merged.set(category, entry)
  }

  for (const item of items) {
    const category = categories.find((entry) => entry.toLowerCase() === item.toLowerCase())
    const mapped = Object.hasOwn(known, item) ? known[item] : undefined
    if (category) add(category)
    else if (mapped) add(mapped, item)
    else custom.push(item)
  }
  const onlyCategory = merged.size === 1 ? [...merged.keys()][0] : 'Other interests'
  for (const term of custom) add(onlyCategory, term)
  return [...merged.values()]
})

export const interestsSchema = structured.or(legacy)
export const interestsResponseSchema = interestsSchema.or(z.tuple([]))

export const focusSuggestions: Record<Category, string[]> = {
  Science: ['Space exploration', 'Climate research', 'Biology'],
  Technology: ['Artificial intelligence', 'Consumer tech', 'Software development'],
  Music: ['New albums', 'Tour announcements', 'Hip-hop'],
  Entertainment: ['Film releases', 'Streaming TV', 'Awards'],
  Sports: ['NBA', 'Premier League', 'Formula 1'],
  Business: ['Startups', 'Company news', 'Retail'],
  Finance: ['Stock markets', 'Earnings', 'Personal finance'],
  Gaming: ['Indie games', 'Game releases', 'Esports'],
  Careers: ['Internships', 'Engineering roles', 'Hiring trends'],
  'Other interests': [],
}
