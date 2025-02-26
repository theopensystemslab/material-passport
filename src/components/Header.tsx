import { type JSX } from 'react'

import { Breadcrumb } from '@/components/Breadcrumb'
import { ProfileButton } from '@/components/ProfileButton'

export const Header = (): JSX.Element => {
  return (
    <header className="flex justify-between items-centre p-4 pl-8">
      <Breadcrumb />
      <ProfileButton href="/profile"/>
    </header>
  )
}
