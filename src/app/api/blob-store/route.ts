// utility function to clean up blob store as and when
// vendored from https://vercel.com/docs/vercel-blob#deleting-all-blobs
import 'server-only'

import { del, list } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export const GET = async (): Promise<NextResponse> => {
  return new NextResponse('This route expects a DELETE request', { status: 405 })
}
 
export const DELETE = async (req: NextRequest): Promise<NextResponse> => {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  let cursor
 
  do {
    const listResult: {
      blobs: { url: string }[],
      cursor?: string,
    } = await list({
      cursor,
      limit: 1000,
    })
 
    if (listResult.blobs.length > 0) {
      await del(listResult.blobs.map((blob) => blob.url))
    }
 
    cursor = listResult.cursor
  } while (cursor)
 
  return new NextResponse('All blobs were deleted', { status: 200 })
}
