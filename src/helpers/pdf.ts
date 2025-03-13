import fs from 'fs'
import path from 'path'
import type { Writable } from 'stream'

import PDFDocument from 'pdfkit'
import svgToPdf from 'svg-to-pdfkit'

import { getRecordById } from '@/helpers/airtable'
import {
  type Component,
  type OrderBase,
  type Supplier,
  orderBaseTable,
  suppliersTable,
} from '@/lib/schema'

const PDFKIT_ASSETS_DIR = path.resolve('node_modules/pdfkit/js/data')
const PDFKIT_MINIMAL_ASSETS = [
  'Helvetica.afm',
  'sRGB_IEC61966_2_1.icc',
]
const NEXT_START_ASSET_DIRS = [
  path.resolve('.next/server/app/api/airtable/generate-pdf/data'),
  path.resolve('.next/server/chunks/data'),
]
const NEXT_DEV_ASSET_DIRS = [
  path.resolve('.next/server/vendor-chunks/data'),
  path.resolve('.next/server/chunks/data'),
]

// constants for layout of pdf
const CENTRAL_COLUMN_WIDTH_PS = 160
const Y_MARGIN_PS = 20
const X_MARGIN_PS = 70
const WIKIHOUSE_SVG_HEIGHT_PS = 50
const MINOR_GAP_PS = 2
const MEDIUM_GAP_PS = 5
const MAJOR_GAP_PS = 10

export const writePdfToStream = async (
  stream: Writable,
  component: Component,
  qrDataImage: string | undefined = undefined,
): Promise<boolean> => {
  try {
    const uid = component.componentUid as string
    const order = await getRecordById<OrderBase>(orderBaseTable, component.orderBase[0])
    if (!order) {
      throw new Error(`Failed to fetch order for component ${uid}`)
    }
    const qr = qrDataImage ?? component.qrCodeBase64
    if (!qr) {
      throw new Error(`No QR data image passed in, or otherwise available on component ${uid}`)
    }
    const suppliers = []
    for (const recordId of order.supplier) {
      const supplier = await getRecordById<Supplier>(suppliersTable, recordId)
      if (supplier) {
        suppliers.push(supplier)
      }
    }
    if (suppliers.length === 0) {
      throw new Error(`Failed to fetch supplier(s) for order ${order.orderRef}`)
    }
    
    // using pdfkit over pdfmake because bundler problems were more difficult to overcome for the latter (and silent!)
    ensureAssets()
    console.log(`Generating pdf for component ${uid}`)
    const doc = new PDFDocument({
      // ISO A6 = 297.64 x 419.53 PostScript/DTP points (~105×148mm) - see https://pdfkit.org/docs/paper_sizes.html
      size: 'A6',
      // we supply document metadata here
      info: {
        Title: uid,
        Author: 'Material Passport',
      },
      // intend this document to be long-lived and self-contained, with maximum visual integrity
      subset: 'PDF/A-3b',
      pdfVersion: '1.7',
      tagged: true,
      // all margins default to 70 PS
      margins: {
        top: Y_MARGIN_PS,
        bottom: Y_MARGIN_PS,
        left: X_MARGIN_PS,
        right: X_MARGIN_PS,
      },
    })

    console.debug('Registering Inter fonts from assets')
    const assetsPath = path.join(process.cwd(), 'src', 'assets')
    const fontsPath = path.join(assetsPath, 'font')
    doc.registerFont('inter', path.join(fontsPath, 'Inter-VariableFont_opsz,wght.ttf'))
    doc.registerFont('inter18Bold', path.join(fontsPath, 'Inter_18pt-Bold.ttf'))
    doc.registerFont('inter24SemiBold', path.join(fontsPath, 'Inter_24pt-SemiBold.ttf'))
    doc.registerFont('inter24Thin', path.join(fontsPath, 'Inter_24pt-Thin.ttf'))

    console.debug('Writing pdf to stream passed in (e.g. file, buffer, or http response)')
    doc.pipe(stream)

    console.debug('Adding content to pdf')
    // we use 'hanging' text in first section to simplify Y-axis calculations
    doc.font('inter24Thin').fontSize(24).text(uid, {
      align: 'center',
      baseline: 'hanging',
    })
    let yAccumulatorPs = Y_MARGIN_PS + doc.heightOfString(uid) - MEDIUM_GAP_PS
    doc.image(qr,
      // x and y values passed here determine the position of the top left corner of an item
      getXPositionForCenteredItem(doc),
      yAccumulatorPs,
      {
        cover: [CENTRAL_COLUMN_WIDTH_PS, CENTRAL_COLUMN_WIDTH_PS],
        align: 'center',
      })

    const wikihouseSvgPath = path.join(assetsPath, 'svg', 'wikihouse_main_black.svg')
    const wikihouseSvg = fs.readFileSync(wikihouseSvgPath, 'utf-8')
    yAccumulatorPs += (CENTRAL_COLUMN_WIDTH_PS - MEDIUM_GAP_PS)
    // svg is adjusted to a size of 214x67 pixels (i.e. ~160x50 PS), to align with the QR
    svgToPdf(doc, wikihouseSvg,
      getXPositionForCenteredItem(doc),
      yAccumulatorPs - MEDIUM_GAP_PS,
    )

    yAccumulatorPs += (WIKIHOUSE_SVG_HEIGHT_PS - MAJOR_GAP_PS)
    doc.font('inter').fontSize(getFontSizeForWidth(doc, order.orderRef, CENTRAL_COLUMN_WIDTH_PS))
      .text(order.orderRef, getXPositionForCenteredItem(doc), yAccumulatorPs, {
        align: 'center',
        baseline: 'hanging',
      })

    // since we didn't line break previous text, we have to manually add a line
    yAccumulatorPs += doc.currentLineHeight() + MEDIUM_GAP_PS
    doc.moveTo(X_MARGIN_PS, yAccumulatorPs)
      .lineTo(doc.page.width - X_MARGIN_PS, yAccumulatorPs).stroke()
    
    yAccumulatorPs += MEDIUM_GAP_PS
    doc.fontSize(11).text('WEIGHT:', X_MARGIN_PS, yAccumulatorPs)
    const massText = `${String(component.totalMass)} kg`
    doc.text(massText, getXPositionForRightAlignedText(doc, massText), yAccumulatorPs)

    yAccumulatorPs += doc.currentLineHeight() + MINOR_GAP_PS
    doc.text('DATE:', X_MARGIN_PS, yAccumulatorPs)
    // date comes from airtable as seconds since epoch, but Date constructor expects ms
    // TODO: this date is when the component record was created (i.e. synced from order base) - is that what we want to show?
    const date = new Date(component.createdAt * 1000).toISOString().split('T')[0]
    doc.text(date, getXPositionForRightAlignedText(doc, date), yAccumulatorPs)

    // TODO: enable as many suppliers as necessary to be displayed (e.g. via some variation on getFontSizeForWidth)
    yAccumulatorPs += doc.currentLineHeight() + MAJOR_GAP_PS
    doc.text('PRODUCED BY:', X_MARGIN_PS, yAccumulatorPs)
    for (const supplier of suppliers) {
      yAccumulatorPs += doc.currentLineHeight() + MEDIUM_GAP_PS
      doc.font('inter18Bold').fontSize(11).text(supplier.supplierName,
        getXPositionForRightAlignedText(doc, supplier.supplierName), yAccumulatorPs)
      yAccumulatorPs += doc.currentLineHeight() + MINOR_GAP_PS
      doc.font('inter').fontSize(9).text(supplier.location,
        getXPositionForRightAlignedText(doc, supplier.location), yAccumulatorPs)
    }

    console.debug('Finished adding content - closing document stream')
    doc.end()
    return true
  } catch (error) {
    console.error(`Failed to generate pdf for component ${component.componentUid}`, error)
    return false
  }
}

// inspired by: https://www.reddit.com/r/nextjs/comments/1eqasu1/cant_use_pdfkit_library_with_nextjs_app_route/
// TODO: implement a less hacky solution based on webpack config, e.g. https://github.com/foliojs/pdfkit/tree/master/examples/webpack
const ensureAssets = (
  assets: string[] = PDFKIT_MINIMAL_ASSETS,
): void => {
  const sourceDir = PDFKIT_ASSETS_DIR
  // determine where to copy assets based on env (NB. can only run this on dev server with webpack i.e. no `--turbo` flag!)
  // we take a precautionary approach here and copy assets to multiple locations for the best chance of success
  const destDirs = (process.env.NODE_ENV === 'production') ? NEXT_START_ASSET_DIRS : NEXT_DEV_ASSET_DIRS
  console.debug('Ensuring assets for pdfkit (e.g. AFM/ICC files) are available to Next server')
  console.debug(`Source of assets: ${sourceDir}`)
  console.debug(`Running in Node environment: ${process.env.NODE_ENV}`)
  
  // ensure destination directory exists, and create it if not
  for (const destDir of destDirs) {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }
  }

  // if no assets specified, we copy all pdfkit assets across
  const files = (assets.length === 0) ? fs.readdirSync(sourceDir) : assets
  for (const destDir of destDirs) {
    const filesCopied = copyFilesSync(sourceDir, destDir, files)
    if (filesCopied > 0) {
      console.debug(`${files.length} pdfkit assets copied to ${destDir}`)
    } else {
      console.debug(`All pdfkit assets specified already available in ${destDir}`)
    }
  }
}

const copyFilesSync = (sourceDir: string, destDir: string, files: string[]): number => {
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

const getXPositionForCenteredItem = (
  doc: typeof PDFDocument,
  itemWidth: number = CENTRAL_COLUMN_WIDTH_PS,
): number => doc.page.width / 2 - (itemWidth / 2)

const getXPositionForRightAlignedText = (
  doc: typeof PDFDocument,
  text: string,
): number => doc.page.width - (X_MARGIN_PS + doc.widthOfString(text))

// this method returns the largest font size that will allow a given piece of text to fit a given width
const getFontSizeForWidth = (
  doc: typeof PDFDocument,
  text: string,
  width: number,
  maxFontSize: number = 16,
): number => {
  let fontSize = maxFontSize
  do {
    fontSize--
  } while (doc.fontSize(fontSize).widthOfString(text) > width)
  console.debug(`Text '${text}' must be font size ${fontSize} to fit in width ${width} PS`)
  return fontSize
}
