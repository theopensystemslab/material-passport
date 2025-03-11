import { type JSX } from 'react'
import { type HeaderProps } from 'react-html-props'

import { Breadcrumb } from '@/components/Breadcrumb'
import { ProfileButton } from '@/components/ProfileButton'
import { cn } from '@/lib/utils'

interface HeaderPropsCN extends HeaderProps {
  className?: string,
}

export const Header = ({ className, ...props }: HeaderPropsCN): JSX.Element => {
  return (
    <header
      {...props}
      className={cn(className, 'flex justify-between items-center p-4 pl-8 pb-2')}
    >
      <Breadcrumb />
      <ProfileButton href="/profile"/>
    </header>
  )
}
