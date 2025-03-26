import { JSX } from 'react'

import { CenteredContainer } from '@/components/CenteredContainer'
import { ReturnButton } from '@/components/ReturnButton'

// basic 404
export default function NotFound(): JSX.Element {
  return (<>
    <ReturnButton href="/" label="Go home" />
    <CenteredContainer>
      <h1>404</h1>
      <p>These are not the blocks you&apos;re looking for</p>
    </CenteredContainer>
  </>
  )
}
