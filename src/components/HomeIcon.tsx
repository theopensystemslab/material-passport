import { Home } from 'lucide-react'
import Link from 'next/link'
import { type JSX } from 'react'

export const HomeIcon = (): JSX.Element => {
  return (
    <Link href="/">
      <Home />
    </Link>
  )
}
