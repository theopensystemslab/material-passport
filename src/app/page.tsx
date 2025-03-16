import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default async function Page({
  // params,
  // searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return (
    // TODO: make this double as the login page for now i.e. login as..., and have that context inform rest of app
    <div className="flex flex-col flex-grow justify-center items-center space-y-4">
      <Button variant="default" size="lg" asChild className="px-16 py-4">
        <Link href={'/login'}>
          Login
        </Link>
      </Button>
      <Button variant="default" size="lg" asChild className="px-16 py-4">
        <Link href={'/scan'}>
          Scan a QR code
        </Link>
      </Button>
    </div>
  )
}
