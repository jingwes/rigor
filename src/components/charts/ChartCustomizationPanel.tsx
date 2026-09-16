import { useId } from 'react'
import { evaluateLogScaleRequest } from '../../rules/visualizationRules'
import type { ChartCustomizationOptions } from './types'

export interface ChartCustomizationPanelProps {
  value: ChartCustomizationOptions
  onChange: (next: ChartCustomizationOptions) => void
  /** The group/category keys currently plotted, for per-group label overrides. */
  groupKeys: string[]
  /** All values currently plotted, used only to decide whether a log axis
   * can be offered - never to change the numbers themselves. */
  values: number[]
}

/**
 * Figure customization controls. Every control here only ever affects how
 * the chart is *drawn* - none of it can change the underlying numbers.
 * Fully keyboard-navigable, native form controls with associated <label>s.
 */
export function ChartCustomizationPanel({
  value,
  onChange,
  groupKeys,
  values,
}: ChartCustomizationPanelProps) {
  const idPrefix = useId()
  const logEvaluation = evaluateLogScaleRequest(values)

  function set<K extends keyof ChartCustomizationOptions>(
    key: K,
    next: ChartCustomizationOptions[K],
  ) {
    onChange({ ...value, [key]: next })
  }

  function setGroupLabel(groupKey: string, label: string) {
    onChange({
      ...value,
      groupLabelOverrides: {
        ...value.groupLabelOverrides,
        [groupKey]: label,
      },
    })
  }

  function parseOptionalNumber(raw: string): number | undefined {
    if (raw.trim() === '') return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return (
    <fieldset className="chart-customization-panel">
      <legend>Customize this chart</legend>

      <div className="field">
        <label htmlFor={`${idPrefix}-figure-title`}>Figure title</label>
        <input
          id={`${idPrefix}-figure-title`}
          type="text"
          value={value.figureTitle ?? ''}
          onChange={(e) => set('figureTitle', e.target.value || undefined)}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-x-axis-title`}>X-axis title</label>
        <input
          id={`${idPrefix}-x-axis-title`}
          type="text"
          value={value.xAxisTitle ?? ''}
          onChange={(e) => set('xAxisTitle', e.target.value || undefined)}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-y-axis-title`}>Y-axis title</label>
        <input
          id={`${idPrefix}-y-axis-title`}
          type="text"
          value={value.yAxisTitle ?? ''}
          onChange={(e) => set('yAxisTitle', e.target.value || undefined)}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-y-axis-unit`}>Y-axis unit</label>
        <input
          id={`${idPrefix}-y-axis-unit`}
          type="text"
          placeholder="e.g. ms, cm, %"
          value={value.yAxisUnit ?? ''}
          onChange={(e) => set('yAxisUnit', e.target.value || undefined)}
        />
      </div>

      {groupKeys.length > 0 && (
        <div className="field group-label-overrides">
          <span className="field-legend-like">Group labels</span>
          {groupKeys.map((groupKey) => (
            <div key={groupKey} className="field">
              <label htmlFor={`${idPrefix}-group-label-${groupKey}`}>
                Label for {groupKey}
              </label>
              <input
                id={`${idPrefix}-group-label-${groupKey}`}
                type="text"
                value={value.groupLabelOverrides?.[groupKey] ?? groupKey}
                onChange={(e) => setGroupLabel(groupKey, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor={`${idPrefix}-point-size`}>Point size (px)</label>
        <input
          id={`${idPrefix}-point-size`}
          type="number"
          min={1}
          max={20}
          value={value.pointRadiusPx}
          onChange={(e) => set('pointRadiusPx', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-line-width`}>Line width (px)</label>
        <input
          id={`${idPrefix}-line-width`}
          type="number"
          min={0.5}
          max={10}
          step={0.5}
          value={value.lineWidthPx}
          onChange={(e) => set('lineWidthPx', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-font-size`}>Font size (px)</label>
        <input
          id={`${idPrefix}-font-size`}
          type="number"
          min={8}
          max={32}
          value={value.fontSizePx}
          onChange={(e) => set('fontSizePx', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-width`}>Width (px)</label>
        <input
          id={`${idPrefix}-width`}
          type="number"
          min={200}
          max={1600}
          value={value.widthPx}
          onChange={(e) => set('widthPx', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-height`}>Height (px)</label>
        <input
          id={`${idPrefix}-height`}
          type="number"
          min={150}
          max={1600}
          value={value.heightPx}
          onChange={(e) => set('heightPx', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-y-axis-min`}>
          Y-axis baseline (blank = automatic)
        </label>
        <input
          id={`${idPrefix}-y-axis-min`}
          type="number"
          value={value.yAxisMin ?? ''}
          onChange={(e) => set('yAxisMin', parseOptionalNumber(e.target.value))}
        />
      </div>

      <div className="field checkbox-field">
        <label htmlFor={`${idPrefix}-show-legend`}>
          <input
            id={`${idPrefix}-show-legend`}
            type="checkbox"
            checked={value.showLegend}
            onChange={(e) => set('showLegend', e.target.checked)}
          />
          Show legend
        </label>
      </div>

      <div className="field checkbox-field">
        <label htmlFor={`${idPrefix}-log-scale`}>
          <input
            id={`${idPrefix}-log-scale`}
            type="checkbox"
            checked={value.yScaleType === 'log'}
            disabled={!logEvaluation.allowed}
            onChange={(e) =>
              set('yScaleType', e.target.checked ? 'log' : 'linear')
            }
          />
          Logarithmic Y-axis
        </label>
        {!logEvaluation.allowed && (
          <p className="field-hint">
            {logEvaluation.warning?.message ??
              'A log axis is not available for this data.'}
          </p>
        )}
      </div>
    </fieldset>
  )
}
