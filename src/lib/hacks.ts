import fs from 'fs'
import path from 'path'

import 'server-only'

const PDFKIT_MINIMAL_ASSETS = ['Helvetica.afm', 'sRGB_IEC61966_2_1.icc']
const PDFKIT_ASSETS_DIR = path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data')
const NEXT_START_ASSET_DIR = path.join(process.cwd(), '.next', 'server', 'chunks', 'data')
const NEXT_DEV_ASSET_DIR = path.join(process.cwd(), '.next', 'server', 'vendor-chunks', 'data')

// util which ensured pdfkit assets were available to Next server at runtime (supplanted by a webpack plugin solution - see next.config.ts)
// inspired by: https://www.reddit.com/r/nextjs/comments/1eqasu1/cant_use_pdfkit_library_with_nextjs_app_route/
export const ensureAssets = (
  assets: string[] = PDFKIT_MINIMAL_ASSETS,
): void => {
  const sourceDir = PDFKIT_ASSETS_DIR
  // we take a precautionary approach here and copy assets to multiple locations for the best chance of success
  const destDir = (process.env.NODE_ENV === 'production') ? NEXT_START_ASSET_DIR : NEXT_DEV_ASSET_DIR
  console.debug('Ensuring assets for pdfkit (e.g. AFM/ICC files) are available to Next server')
  console.debug(`Source of assets: ${sourceDir}`)
  console.debug(`Running in Node environment: ${process.env.NODE_ENV}`)
  
  // ensure destination directory exists, and create it if not
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  // if no assets specified, we copy all pdfkit assets across
  const files = (assets.length === 0) ? fs.readdirSync(sourceDir) : assets
  const filesCopied = copyFilesSync(sourceDir, destDir, files)
  if (filesCopied > 0) {
    console.debug(`${files.length} pdfkit assets copied to ${destDir}`)
  } else {
    console.debug(`All pdfkit assets specified already available in ${destDir}`)
  }
}

export const copyFilesSync = (sourceDir: string, destDir: string, files: string[]): number => {
  let filedCopied = 0
  for (const filename of files) {
    const sourcePath = path.join(sourceDir, filename)
    const destPath = path.join(destDir, filename)
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(sourcePath, destPath)
      filedCopied++
    }
  }
  return filedCopied
}
