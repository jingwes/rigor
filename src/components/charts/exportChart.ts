/**
 * Milestone 5: SVG/PNG export for chart components.
 *
 * Native browser APIs only - no new dependency. A rendered `<svg>` element
 * is serialized with `XMLSerializer` for SVG export; for PNG, that same
 * serialized markup is drawn onto an off-screen `<canvas>` via an `Image`
 * element and read back out with `canvas.toDataURL('image/png')`. Because
 * both export paths start from the exact DOM node that's on screen
 * (customization and all), the exported file always visually matches what
 * the student sees - there is no separate "export renderer" to drift out of
 * sync.
 */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * Serializes a rendered `<svg>` element to a self-contained XML string,
 * making sure the `xmlns` attribute is present (required for the markup to
 * be valid standalone SVG/loadable as an `<img>` source).
 */
export function serializeSvgElement(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', SVG_NAMESPACE)
  }
  return new XMLSerializer().serializeToString(clone)
}

/** A `data:image/svg+xml` URL for the given SVG element - directly usable
 * as a download link `href` or an `<img src>`. */
export function exportSvgAsDataUrl(svg: SVGSVGElement): string {
  const markup = serializeSvgElement(svg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

/** The SVG element's markup as a downloadable `Blob`. */
export function exportSvgAsBlob(svg: SVGSVGElement): Blob {
  return new Blob([serializeSvgElement(svg)], {
    type: 'image/svg+xml;charset=utf-8',
  })
}

function readSvgDimensions(svg: SVGSVGElement): {
  width: number
  height: number
} {
  const width = Number(svg.getAttribute('width'))
  const height = Number(svg.getAttribute('height'))
  return {
    width: Number.isFinite(width) && width > 0 ? width : 480,
    height: Number.isFinite(height) && height > 0 ? height : 360,
  }
}

export interface PngExportOptions {
  /** Multiplies the SVG's own width/height, e.g. 2 for a retina-resolution
   * export. Defaults to 1 (exports at the on-screen size). */
  scale?: number
}

/**
 * Rasterizes a rendered `<svg>` element to a `data:image/png` URL, at the
 * SVG's own width/height (times an optional `scale`). Draws through an
 * off-screen `<canvas>`, so the exported pixels are exactly what's on
 * screen (same customization, same points, same error bars).
 */
export function exportSvgAsPngDataUrl(
  svg: SVGSVGElement,
  options: PngExportOptions = {},
): Promise<string> {
  const scale = options.scale ?? 1
  const { width, height } = readSvgDimensions(svg)
  const canvasWidth = Math.round(width * scale)
  const canvasHeight = Math.round(height * scale)

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        const context = canvas.getContext('2d')
        if (!context) {
          reject(
            new Error(
              'exportSvgAsPngDataUrl: could not obtain a 2D canvas context',
            ),
          )
          return
        }
        context.drawImage(image, 0, 0, canvasWidth, canvasHeight)
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    image.onerror = () => {
      reject(
        new Error(
          'exportSvgAsPngDataUrl: failed to load the serialized SVG as an image',
        ),
      )
    }

    image.src = exportSvgAsDataUrl(svg)
  })
}

/** Triggers a browser download of a data URL/Blob URL under `filename`. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
