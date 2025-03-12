import type { Writable } from 'stream'

import { toDataURL, toFileStream } from 'qrcode'

// QR codes on components may become dirty or damaged, so we use the highest error resistance value
const ERROR_CORRECTION_LEVEL = 'H'
        
export const generateQrDataImage = async (textToEncode: string): Promise<string> => {
  return toDataURL(textToEncode, {
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
  })
}

export const generateQrPngStream = async (stream: Writable, textToEncode: string): Promise<void> => {
  return toFileStream(stream, textToEncode, { 
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    type: 'png',
  })
}
