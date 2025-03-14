import fs from 'fs'
import path from 'path'
import type { Writable } from 'stream'

import 'server-only'
import { toMerged } from 'es-toolkit'
import PDFDocument from 'pdfkit'
import svgToPdf from 'svg-to-pdfkit'

import { getRecordById } from '@/lib/airtable'
// we vendor our own copy of TextOptions interface because pdfkit doesn't export it
import type { TextOptions } from '@/lib/definitions'
import {
  type Component,
  type OrderBase,
  type Supplier,
  orderBaseTable,
  suppliersTable,
} from '@/lib/schema'

// we determine here some constants for overall layout of the label
const CENTRAL_COLUMN_WIDTH_PS = 160 // + (x margin * 2) = 300 PS (i.e. ~ A6 width)
const Y_MARGIN_PS = 20
const X_MARGIN_PS = 70
const WIKIHOUSE_SVG_HEIGHT_PS = 50
const MINOR_GAP_PS = 2
const MEDIUM_GAP_PS = 5
const MAJOR_GAP_PS = 10

// we use 'hanging' text and assume against line breaks to control (x,y) position and simplify calculations
const DEFAULT_TEXT_OPTIONS: TextOptions = {
  align: 'center',
  baseline: 'hanging',
  width: CENTRAL_COLUMN_WIDTH_PS,
  lineBreak: false,
}

// FIXME: this method only works on local (dev/build) with webpack (i.e. `next dev`) - not on prod!
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
    
    // using pdfkit over pdfmake because bundler problems looked more difficult to overcome for the latter (and silent!)
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

    // register Inter fonts from assets, to be embedded in the pdf
    const assetsPath = path.join(process.cwd(), 'src', 'assets')
    const fontsPath = path.join(assetsPath, 'font')
    doc.registerFont('inter', path.join(fontsPath, 'Inter-VariableFont_opsz,wght.ttf'))
    doc.registerFont('inter18Bold', path.join(fontsPath, 'Inter_18pt-Bold.ttf'))
    doc.registerFont('inter24SemiBold', path.join(fontsPath, 'Inter_24pt-SemiBold.ttf'))
    doc.registerFont('inter24Thin', path.join(fontsPath, 'Inter_24pt-Thin.ttf'))

    console.debug('Piping pdf to stream passed in (e.g. file, buffer, or http response)')
    doc.pipe(stream)

    // write 1st section - UID, QR code, Wikihouse logo and order ref
    console.debug('Writing content to document')
    doc.font('inter24Thin').fontSize(24).text(uid, DEFAULT_TEXT_OPTIONS)

    // we initialise an 'accumulator' for the Y axis, to track desired cursor position as we move down the page
    let yAccumulatorPs = Y_MARGIN_PS + doc.heightOfString(uid) - MEDIUM_GAP_PS
    doc.image(qr,
      // x and y values passed determine the position of the top left corner of an item
      getXPositionForCenteredItem(doc),
      yAccumulatorPs,
      {
        cover: [CENTRAL_COLUMN_WIDTH_PS, CENTRAL_COLUMN_WIDTH_PS],
        align: 'center',
      })

    yAccumulatorPs += (CENTRAL_COLUMN_WIDTH_PS - MEDIUM_GAP_PS)
    // svg is adjusted to a size of 214x67 pixels (i.e. ~160x50 PS), to align with the QR
    const wikihouseSvgPath = path.join(assetsPath, 'svg', 'wikihouse_main_black.svg')
    const wikihouseSvg = fs.readFileSync(wikihouseSvgPath, 'utf-8')
    svgToPdf(doc, wikihouseSvg,
      getXPositionForCenteredItem(doc),
      yAccumulatorPs - MEDIUM_GAP_PS,
    )

    yAccumulatorPs += (WIKIHOUSE_SVG_HEIGHT_PS - MAJOR_GAP_PS)
    doc.font('inter').fontSize(getFontSizeForWidth(doc, order.orderRef))
      .text(order.orderRef, getXPositionForCenteredItem(doc), yAccumulatorPs, DEFAULT_TEXT_OPTIONS)

    // since we didn't line break previous text / are controlling (x,y) position, we manually add a line before separator
    yAccumulatorPs += doc.currentLineHeight() + MEDIUM_GAP_PS
    doc.moveTo(X_MARGIN_PS, yAccumulatorPs)
      .lineTo(doc.page.width - X_MARGIN_PS, yAccumulatorPs).stroke()
    
    // write 2nd section - weight, date of production, manufacturer's name and address
    yAccumulatorPs += MEDIUM_GAP_PS
    doc.fontSize(11).text('WEIGHT:', X_MARGIN_PS, yAccumulatorPs)
    const massText = `${String(component.totalMass)} kg`
    doc.text(massText, getXPositionForRightAlignedText(doc, massText), yAccumulatorPs)

    yAccumulatorPs += doc.currentLineHeight() + MINOR_GAP_PS
    doc.text('DATE:', X_MARGIN_PS, yAccumulatorPs)
    // NB. date comes from airtable as seconds since epoch, but Date constructor expects ms
    const date = new Date(component.createdAt * 1000).toISOString().split('T')[0]
    doc.text(date, getXPositionForRightAlignedText(doc, date), yAccumulatorPs)

    // TODO: adapt below to allow for indeterminate number of suppliers to be displayed (e.g. via a variation on getFontSizeForWidth)
    // currently, we assume a maximum of 2 suppliers
    yAccumulatorPs += doc.currentLineHeight() + MINOR_GAP_PS
    doc.text('PRODUCED BY:', X_MARGIN_PS, yAccumulatorPs)
    yAccumulatorPs += doc.currentLineHeight() + MINOR_GAP_PS
    const supplierTextOptions = toMerged(DEFAULT_TEXT_OPTIONS, {
      align: 'right',
      lineBreak: true,
    })
    for (const supplier of suppliers) {
      // overwrite some text options to right-align supplier details and allow them to wrap over multiple lines
      doc.font('inter18Bold').fontSize(11)
      const supplierNameHeightPs = doc.heightOfString(supplier.supplierName, supplierTextOptions)
      doc.text(supplier.supplierName, X_MARGIN_PS, yAccumulatorPs, supplierTextOptions)
      yAccumulatorPs += supplierNameHeightPs + MINOR_GAP_PS
      doc.font('inter').fontSize(9)
      const supplierLocationHeightPs = doc.heightOfString(supplier.location, supplierTextOptions)
      doc.font('inter').fontSize(9).text(supplier.location, X_MARGIN_PS, yAccumulatorPs, supplierTextOptions)
      yAccumulatorPs += supplierLocationHeightPs + MEDIUM_GAP_PS
    }

    console.debug('Finished adding content - closing document stream')
    doc.end()
    return true
  } catch (error) {
    console.error(`Failed to generate pdf for component ${component.componentUid}`, error)
    return false
  }
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
  width: number = CENTRAL_COLUMN_WIDTH_PS,
  maxFontSize: number = 16,
): number => {
  let fontSize = maxFontSize
  do {
    fontSize--
  } while (doc.fontSize(fontSize).widthOfString(text) > width)
  console.debug(`Text '${text}' must be font size ${fontSize} to fit in width ${width} PS`)
  return fontSize
}
