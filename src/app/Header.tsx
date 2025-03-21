import Image from 'next/image'
import Link from 'next/link'
import { type JSX } from 'react'
import { type HeaderProps } from 'react-html-props'

import { ProfileButton } from '@/app/ProfileButton'
import { cn } from '@/lib/utils'

interface HeaderPropsCN extends HeaderProps {
  className?: string,
}

export const Header = ({ className, ...props }: HeaderPropsCN): JSX.Element => {
  return (
    <header
      {...props}
      className={cn(className, 'flex justify-between items-center p-6 pb-2')}
    >
      <div className="flex items-center justify-start space-x-4 lg:space-x-8">
        <Link href="/" className="relative w-8 h-8 lg:w-10 lg:h-10">
          <Image
            className="object-cover object-center"
            src="/material_passport_logo.svg"
            alt="Material Passport logo and home button"
            unoptimized
            priority
            fill
          />
        </Link>
        {/* this styling is a subset of the styles applied to h2 in globals.css */}
        <p className="scroll-m-8 text-xl font-semibold tracking-tight lg:text-2xl">
          Material Passport
        </p>
      </ div>
      <ProfileButton href="/profile"/>
    </header>
  )
}
