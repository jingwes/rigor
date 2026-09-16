import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { DotPlot } from './DotPlot'
import {
  downloadDataUrl,
  exportSvgAsBlob,
  exportSvgAsDataUrl,
  exportSvgAsPngDataUrl,
  serializeSvgElement,
} from './exportChart'

function renderSampleDotPlot(): SVGSVGElement {
  const { container } = render(
    createElement(DotPlot, {
      groups: [
        { label: 'Control', values: [1, 2, 3, 4] },
        { label: 'Treatment', values: [5, 6, 7] },
      ],
      intervalType: 'sd',
      customization: { widthPx: 500, heightPx: 300 },
    }),
  )
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('expected an <svg> element to be rendered')
  return svg
}

describe('serializeSvgElement / exportSvgAsDataUrl', () => {
  it('produces well-formed SVG markup with an xmlns and the right dimensions', () => {
    const svg = renderSampleDotPlot()
    const markup = serializeSvgElement(svg)

    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(markup).toContain('width="500"')
    expect(markup).toContain('height="300"')
  })

  it('contains one point marker per raw observation (7 total)', () => {
    const svg = renderSampleDotPlot()
    const markup = serializeSvgElement(svg)
    const pointCount = (markup.match(/class="chart-point"/g) ?? []).length
    expect(pointCount).toBe(7)
  })

  it('exportSvgAsDataUrl produces a decodable data URL with matching content', () => {
    const svg = renderSampleDotPlot()
    const dataUrl = exportSvgAsDataUrl(svg)
    expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)

    const decoded = decodeURIComponent(
      dataUrl.replace('data:image/svg+xml;charset=utf-8,', ''),
    )
    expect(decoded).toContain('<svg')
    expect((decoded.match(/class="chart-point"/g) ?? []).length).toBe(7)
  })
})

describe('exportSvgAsBlob', () => {
  it('produces a well-formed SVG Blob whose content matches the element', async () => {
    const svg = renderSampleDotPlot()
    const blob = exportSvgAsBlob(svg)
    expect(blob.type).toBe('image/svg+xml;charset=utf-8')
    const text = await blob.text()
    expect(text).toContain('<svg')
    expect((text.match(/class="chart-point"/g) ?? []).length).toBe(7)
  })
})

describe('exportSvgAsPngDataUrl', () => {
  class FakeCanvasContext {
    calls: unknown[][] = []
    drawImage(...args: unknown[]) {
      this.calls.push(args)
    }
  }

  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext
  let originalToDataUrl: typeof HTMLCanvasElement.prototype.toDataURL
  let originalImage: typeof Image

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext
    originalToDataUrl = HTMLCanvasElement.prototype.toDataURL
    originalImage = globalThis.Image

    // jsdom does not implement real 2D canvas rendering or image
    // decoding, so we stub just enough of the browser canvas/Image APIs
    // to exercise exportSvgAsPngDataUrl's own logic (correct canvas
    // sizing, drawImage call, and reading back toDataURL).
    HTMLCanvasElement.prototype.getContext = vi.fn(function (
      this: HTMLCanvasElement,
    ) {
      return new FakeCanvasContext() as unknown as CanvasRenderingContext2D
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    HTMLCanvasElement.prototype.toDataURL = vi.fn(function (
      this: HTMLCanvasElement,
    ) {
      return `data:image/png;fake,${this.width}x${this.height}`
    })

    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      private _src = ''
      get src() {
        return this._src
      }
      set src(value: string) {
        this._src = value
        queueMicrotask(() => this.onload?.())
      }
    }
    // @ts-expect-error - test stub, not a full Image implementation
    globalThis.Image = FakeImage
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl
    globalThis.Image = originalImage
  })

  it('rasterizes at the SVG element size by default', async () => {
    const svg = renderSampleDotPlot()
    const pngDataUrl = await exportSvgAsPngDataUrl(svg)
    expect(pngDataUrl).toBe('data:image/png;fake,500x300')
  })

  it('scales the canvas by the requested factor', async () => {
    const svg = renderSampleDotPlot()
    const pngDataUrl = await exportSvgAsPngDataUrl(svg, { scale: 2 })
    expect(pngDataUrl).toBe('data:image/png;fake,1000x600')
  })

  it('rejects when the image fails to load', async () => {
    class FailingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    // @ts-expect-error - test stub
    globalThis.Image = FailingImage

    const svg = renderSampleDotPlot()
    await expect(exportSvgAsPngDataUrl(svg)).rejects.toThrow(/failed to load/)
  })
})

describe('downloadDataUrl', () => {
  it('creates and cleans up a temporary anchor element without throwing', () => {
    const bodyChildrenBefore = document.body.childElementCount
    downloadDataUrl('data:text/plain,hello', 'test.txt')
    expect(document.body.childElementCount).toBe(bodyChildrenBefore)
  })
})
