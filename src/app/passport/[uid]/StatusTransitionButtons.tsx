// we push any client components as far down the tree as possible
'use client'
import { lowerCase } from 'es-toolkit'
import { type JSX } from 'react'
import { DivProps } from 'react-html-props'

import { changeComponentStatus } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { ComponentStatus, STATUS_TRANSITIONS } from '@/lib/definitions'
import { cn } from '@/lib/utils'

interface ActionButtonProps extends DivProps {
  componentUid: string,
  componentRecordId: string,
  currentComponentStatus: ComponentStatus;
  className?: string;
}

export const StatusTransitionButtons = (
  { componentUid, componentRecordId, currentComponentStatus, className }: ActionButtonProps,
): JSX.Element => {
  return (<div className={cn('flex flex-col space-y-2', className)}>
    {STATUS_TRANSITIONS[currentComponentStatus].map((newStatus, i) => (
      <Button
        key={i}
        variant="default"
        className="rounded-md lg:h-10 lg:px-8 lg:py-4 lg:text-lg"
        onClick={() => changeComponentStatus(componentUid, componentRecordId, newStatus)}
      >
        Mark as {lowerCase(newStatus)}
      </Button>
    ))}
  </div>)
}
