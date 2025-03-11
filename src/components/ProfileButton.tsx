import Link, { type LinkProps } from 'next/link'
import { type JSX } from 'react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/components/ui/avatar'

interface LinkPropsWithClassName extends LinkProps {
  className?: string;
}

// NB. this is a server component, but the imported shadcn components are (always) client components
export const ProfileButton = ({ className, href }: LinkPropsWithClassName): JSX.Element => {
  return (
    <Link href={href} className={className}>
      <Avatar>
        <AvatarImage src="/osl_logo_black.png"/>
        <AvatarFallback>O</AvatarFallback>
      </Avatar>
    </Link>
  )
}
