// has to be a client component in order to access URL/path
'use client'

import { capitalize } from 'es-toolkit'
import { usePathname } from 'next/navigation'
import { type JSX } from 'react'

import { HomeIcon } from '@/components/HomeIcon'
import { Separator } from '@/components/ui/separator'

// TODO: develop into a full breadcrumb/navigation solution?
export const Breadcrumb = (): JSX.Element => {
  const pathname = usePathname()
  const parts = pathname.split('/')
  // use a flag to determine if we show more than home icon
  const showPath = parts.length >= 2 && parts[1] !== ''

  return (
    <div className="flex items-center justify-start gap-4">
      <HomeIcon />
      {showPath && (
        <>
          <Separator orientation="vertical" />
          <h1>{capitalize(parts[1])}</h1>
        </>
      )}
    </ div>
  )
}
