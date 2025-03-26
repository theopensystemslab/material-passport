import { MoveLeft } from 'lucide-react'
import Link from 'next/link'
import { type JSX } from 'react'

import { Button } from '@/components/ui/button'

interface ReturnButtonProps {
  href: string;
  label: string;
}

// designed to be placed at top of page before any other content
export const ReturnButton = ({
  href,
  label,
}: ReturnButtonProps): JSX.Element => {
  return (
    <Button variant="ghost" size="sm" asChild className="p-0 justify-start text-sm lg:text-md">
      <Link href={href}>
        <MoveLeft /> {label}
      </Link>
    </Button>
  )
}
