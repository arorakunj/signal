import AppPage from '@/components/AppPage'
import BriefingArchive from '@/components/BriefingArchive'

export default function StoryArchive() {
  return (
    <AppPage title="Story archive">
      <p className="text-muted-foreground">Choose a date to read its saved edition.</p>
      <BriefingArchive />
    </AppPage>
  )
}
