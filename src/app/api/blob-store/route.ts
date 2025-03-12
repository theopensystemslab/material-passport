// utility function to clean up blob store as and when
// vendored from https://vercel.com/docs/vercel-blob#deleting-all-blobs

import { del, list } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
 
export async function DELETE(req: NextRequest): Promise<NextResponse> {
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
