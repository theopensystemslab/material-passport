// error boundaries have to be client components
'use client'

import { JSX } from 'react'

import { CenteredContainer } from '@/components/CenteredContainer'
import { ReturnButton } from '@/components/ReturnButton'

// basic 500
export default function Error(): JSX.Element {
  return (<>
    <ReturnButton href="/" label="Go home" />
    <CenteredContainer>
      <h1>500</h1>
      <p>The best laid plans...</p>
    </CenteredContainer>
  </>
  )
}
