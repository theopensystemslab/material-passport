'use client'

import { JSX } from 'react'
import { type AProps } from 'react-html-props'
import useSWR from 'swr'

import { AIRTABLE_ATTACHMENT_CACHE_SECONDS } from '@/lib/definitions'
import { fetcher } from '@/lib/utils'

interface AirtableAttachmentLink extends AProps {
  tableId: string,
  recordId: string,
  fieldId: string | string[] | undefined,
  href: string,
  text: string,
  className?: string;
}

// this component is based on AirtableImage.tsx - see that file for more detail
export const AirtableAttachmentLink = ({
  tableId,
  recordId,
  fieldId,
  href,
  text,
  className = '',
  ...props
}: AirtableAttachmentLink): JSX.Element => {
  let url = null
  if (tableId && recordId && fieldId) {
    url = `/api/airtable/get-attachment-url?&tableId=${tableId}&recordId=${recordId}&fieldId=${fieldId}`
  } else {
    console.warn('Required IDs not passed to <AirtableAttachmentLink> - skipping renewal and falling back to supplied href')
  }
    
  const { data: renewedHref, error, isLoading } = useSWR(url, fetcher,
    { 
      revalidateIfStale: true,
      revalidateOnReconnect: false,
      revalidateOnFocus: false,
      dedupingInterval: AIRTABLE_ATTACHMENT_CACHE_SECONDS * 1000,
      refreshInterval: AIRTABLE_ATTACHMENT_CACHE_SECONDS * 1000,
    }
  )

  if (isLoading) {
    return <p> {text} </p>
  } else if (renewedHref) {
    console.debug(`Renewed Airtable attachment URL: ${renewedHref}`)
  } else if (error) {
    console.error('Failed to fetch fresh Airtable attachment URL', error)
  }
  
  return (
    <a
      className={className}
      href={renewedHref || href}
      target="_blank"
      {...props}
    >
      {text}
    </a>
  )
}
