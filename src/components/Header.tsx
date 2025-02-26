import { type JSX } from 'react'
import { type HeaderProps } from 'react-html-props'

import { Breadcrumb } from '@/components/Breadcrumb'
import { ProfileButton } from '@/components/ProfileButton'

export const Header = (props: HeaderProps): JSX.Element => {
  return (
    <header {...props} className="flex justify-between items-centre p-4 pl-8 pb-2">
      <Breadcrumb />
      <ProfileButton href="/profile"/>
    </header>
  )
}
