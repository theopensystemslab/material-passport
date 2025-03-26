import { Construction } from 'lucide-react'

import { CenteredContainer } from '@/components/CenteredContainer'
import { ReturnButton } from '@/components/ReturnButton'

export default async function Page() {
  return (<>
    <ReturnButton href="/" label="Go home" />
    <h2 className="p-4 mb-8">
      My profile
    </h2>
    <CenteredContainer>
      <Construction size={128} />
    </CenteredContainer>
  </>)
}
