import { createFileRoute } from '@tanstack/react-router'
import { StarterRateExperiencePage } from '../components/design-showcase'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return <StarterRateExperiencePage />
}
