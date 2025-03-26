import Link from 'next/link'

import { CenteredContainer } from '@/components/CenteredContainer'
import { Button } from '@/components/ui/button'

export default async function Page() {
  return (
    // TODO: make this double as the login page for now i.e. login as..., and have that context inform rest of app
    <CenteredContainer>
      <Button variant="default" size="lg" asChild className="px-16 py-4">
        <Link href={'/project'}>
          Find your project
        </Link>
      </Button>
      <Button variant="default" size="lg" asChild className="px-16 py-4">
        <Link href={'/scan'}>
          Scan a QR code
        </Link>
      </Button>
    </CenteredContainer>
  )
}
