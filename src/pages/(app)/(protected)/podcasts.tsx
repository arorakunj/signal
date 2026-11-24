import AppPage from '@/components/AppPage'
import BriefingArchive from '@/components/BriefingArchive'
import BriefingPanel from '@/components/BriefingPanel'

export default function Podcasts() {
  return (
    <AppPage title="Podcasts">
      <BriefingPanel kind="podcast" />
      <BriefingArchive podcastsOnly />
    </AppPage>
  )
}
