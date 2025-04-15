'use client'

import Image, { type ImageProps } from 'next/image'
import { JSX } from 'react'
import useSWR from 'swr'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { AIRTABLE_ATTACHMENT_CACHE_SECONDS } from '@/lib/definitions'
import { fetcher } from '@/lib/utils'

interface AirtableImageProps extends ImageProps {
  tableId: string,
  recordId: string,
  fieldId: string | string[] | undefined,
  src: string,
  className?: string;
}

export const AirtableImage = ({
  tableId,
  recordId,
  fieldId,
  src,
  className = '',
  ...props
}: AirtableImageProps): JSX.Element => {
  // only trigger SWR fetch if we have all the required IDs
  let url = null
  if (tableId && recordId && fieldId) {
    url = `/api/airtable/get-attachment-url?&tableId=${tableId}&recordId=${recordId}&fieldId=${fieldId}`
  } else {
    console.warn('Required IDs not passed to <AirtableImage> - skipping renewal and serving src directly')
  }
    
  // we use SWR to fetch fresh image URL from our own server-side API endpoint, and cache it client-side
  const { data: renewedSrc, error, isLoading } = useSWR(url, fetcher,
    {
      // only revalidate if data is stale, no need to replay on network reconnect / tab focus      
      revalidateIfStale: true,
      revalidateOnReconnect: false,
      revalidateOnFocus: false,
      dedupingInterval: AIRTABLE_ATTACHMENT_CACHE_SECONDS * 1000, // SWR expects values in ms
      refreshInterval: AIRTABLE_ATTACHMENT_CACHE_SECONDS * 1000,
    }
  )

  if (isLoading) {
    return <LoadingSpinner />
  } else if (renewedSrc) {
    console.debug(`Renewed Airtable image URL: ${renewedSrc}`)
  } else if (error) {
    console.error('Failed to fetch fresh Airtable image URL', error)
  }
  
  return (
    // we expect alt text to be passed through as a prop, so disable the eslint rule here
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      className={className}
      src={renewedSrc || src}
      {...props}
    />
  )
}
