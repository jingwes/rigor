import type { PointShape } from './groupStyles'

export interface PointMarkerProps {
  shape: PointShape
  cx: number
  cy: number
  /** "Radius" of the marker - other shapes are sized to roughly match a
   * circle of this radius so mixed-shape groups look visually balanced. */
  size: number
  color: string
  className?: string
}

/**
 * Renders one raw-observation point as an SVG shape. Shape (in addition to
 * color and position) is part of a group's identity, so information is
 * never carried by color alone - see `groupStyles.ts`.
 */
export function PointMarker({
  shape,
  cx,
  cy,
  size,
  color,
  className,
}: PointMarkerProps) {
  const commonProps = {
    fill: color,
    className,
  }

  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={size} {...commonProps} />

    case 'square': {
      const side = size * 1.8
      return (
        <rect
          x={cx - side / 2}
          y={cy - side / 2}
          width={side}
          height={side}
          {...commonProps}
        />
      )
    }

    case 'triangle': {
      const h = size * 2
      const points = [
        [cx, cy - h * 0.6],
        [cx - h * 0.6, cy + h * 0.4],
        [cx + h * 0.6, cy + h * 0.4],
      ]
      return (
        <polygon
          points={points.map((p) => p.join(',')).join(' ')}
          {...commonProps}
        />
      )
    }

    case 'triangle-down': {
      const h = size * 2
      const points = [
        [cx, cy + h * 0.6],
        [cx - h * 0.6, cy - h * 0.4],
        [cx + h * 0.6, cy - h * 0.4],
      ]
      return (
        <polygon
          points={points.map((p) => p.join(',')).join(' ')}
          {...commonProps}
        />
      )
    }

    case 'diamond': {
      const h = size * 1.6
      const points = [
        [cx, cy - h],
        [cx + h, cy],
        [cx, cy + h],
        [cx - h, cy],
      ]
      return (
        <polygon
          points={points.map((p) => p.join(',')).join(' ')}
          {...commonProps}
        />
      )
    }

    case 'cross': {
      const arm = size * 1.1
      const thickness = Math.max(size * 0.6, 1.5)
      return (
        <g className={className}>
          <rect
            x={cx - arm}
            y={cy - thickness / 2}
            width={arm * 2}
            height={thickness}
            fill={color}
          />
          <rect
            x={cx - thickness / 2}
            y={cy - arm}
            width={thickness}
            height={arm * 2}
            fill={color}
          />
        </g>
      )
    }

    default:
      return <circle cx={cx} cy={cy} r={size} {...commonProps} />
  }
}
