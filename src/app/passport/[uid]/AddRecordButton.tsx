'use client'

import { type JSX } from 'react'
import { DivProps } from 'react-html-props'

// import { changeComponentStatus } from '@/app/actions'
import { Button } from '@/components/ui/button'
// import { HistoryEvent } from '@/lib/definitions'

interface AddRecordButtonProps extends DivProps {
  className?: string;
}

export const AddRecordButton = (
  {  }: AddRecordButtonProps,
): JSX.Element => {
  return (
    <Button
      // we add a custom variant to the shadcn button for this use case
      variant="tertiary"
      className="flex-grow rounded-md lg:h-10 lg:px-8 lg:py-4 lg:text-lg"
      onClick={() => null}
    >
      Add a record
    </Button>)
}
