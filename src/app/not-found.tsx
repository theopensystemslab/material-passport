import { MoveLeft } from 'lucide-react'
import Link from 'next/link'
import { JSX } from 'react'

import { Button } from '@/components/ui/button'

// basic 404
export default function NotFound(): JSX.Element {
  return (<>
    <Button variant="ghost" size="sm" asChild className="p-0 justify-start text-sm lg:text-md">
      <Link href="/">
        <MoveLeft /> Go home
      </Link>
    </Button>
    <div className="flex flex-col flex-grow justify-center items-center space-y-4">
      <h1>404</h1>
      <p>These are not the blocks you&apos;re looking for</p>
    </ div>
  </>
  )
}
