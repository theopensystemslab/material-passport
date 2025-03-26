'use client'

import { type IDetectedBarcode, Scanner} from '@yudiel/react-qr-scanner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { CenteredContainer } from '@/components/CenteredContainer'

const COMPONENT_UID_REGEX: RegExp = /[a-z]{3}-\d{6}/i
// we allow any junk (e.g. query string) to be tagged onto the end of these URLs - validating on domain and UID is sufficient
const PASSPORT_URL_PRODUCTION_REGEX = new RegExp(
  `^(?:https?:\/\/)?(?:www\.)?wikihouse\.materialpassport\.info\/passport\/${COMPONENT_UID_REGEX.source}`, 'i')
const PASSPORT_URL_PREVIEW_REGEX = new RegExp(
  `^(?:https?:\/\/)?(?:www\.)?material-passport(?:[a-z\-]+)?\.vercel\.app\/passport\/${COMPONENT_UID_REGEX.source}`, 'i')
const PASSPORT_URL_LOCAL_REGEX = new RegExp(
  `^(?:https?:\/\/)?(?:www\.)?localhost:\d{4}\/passport\/${COMPONENT_UID_REGEX.source}`, 'i')

const validatePassportUrl = (url: string): boolean => {
  return PASSPORT_URL_PRODUCTION_REGEX.test(url)
    || PASSPORT_URL_PREVIEW_REGEX.test(url)
    || PASSPORT_URL_LOCAL_REGEX.test(url)
}

const extractUidFromUrl = (url: string): string | null => {
  const match = url.match(COMPONENT_UID_REGEX)
  if (match?.[0]) {
    console.debug(`Extracted UID: ${match[0]}`)
    return match[0]
  }
  console.debug(`Failed to extract UID from URL: ${url}`)
  return null
}

export default function Page() {
  const router = useRouter()
  const [feedback, setFeedback] = useState('Scan the QR code on your component')

  // TODO: finesse the sizing on the scanner - it's a bit janky on some mobiles
  return (<CenteredContainer>
    {/* container for scanner limits how big it will grow (large scan portal looks weird) */}
    <div className="w-2/3 h-auto max-w-lg">
      <Scanner
        // ignore any barcode format that is not a QR code
        // TODO: make sure the scanner fits in small screens
        formats={['qr_code']}
        allowMultiple={false}
        scanDelay={1000}
        onScan={(result: IDetectedBarcode[]): void => {
          for (const qrCode of result) {
            console.debug(`Scanned QR: ${qrCode.rawValue}`)
            if (qrCode.rawValue && validatePassportUrl(qrCode.rawValue)) {
              const uid = extractUidFromUrl(qrCode.rawValue)
              if (uid) {
              // if scanned QR encodes a valid passport URI/URL, and we can extract the UID, we navigate there
                router.push(`/passport/${uid}`)
              } else {
                setFeedback(`Found component ID ${uid}, but expected something like 'ABC-123456'`)
              }
            } else {
              setFeedback('QR code doesn\'t look like a Material Passport URI 🤔')
            }
          }
        }}
        onError={console.error}
      />
    </div>
    <p className="text-center">{feedback}</p>
  </CenteredContainer>)
}


