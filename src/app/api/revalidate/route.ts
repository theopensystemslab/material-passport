import 'server-only'
import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (req: NextRequest): Promise<NextResponse> => {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  revalidatePath('/')
  return new NextResponse('Revalidated all paths', { status: 200 })
}
