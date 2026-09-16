import type { NormalityDiagnosticsResult } from '../../statistics/types'
import { HistogramChart } from './HistogramChart'

const SMALL_SAMPLE_THRESHOLD = 20

export interface GroupNormalityData {
  label: string
  values: number[]
  diagnostics: NormalityDiagnosticsResult | null
  error?: string
}

export interface NormalityDiagnosticsSectionProps {
  groups: GroupNormalityData[]
}

function formatStat(value: number | null, digits = 3): string {
  return value === null ? 'not available' : value.toFixed(digits)
}

function GroupDiagnostics({ label, values, diagnostics, error }: GroupNormalityData) {
  return (
    <div className="normality-group">
      <h4>{label}</h4>
      <HistogramChart values={values} label={label} />

      {!error && !diagnostics && <p role="status">Computing normality diagnostics...</p>}

      {error && (
        <p className="field-error">
          Diagnostics couldn't be computed for this group: {error}
        </p>
      )}

      {!error && diagnostics && (
        <dl className="normality-stats">
          <div>
            <dt>Sample size</dt>
            <dd>n = {diagnostics.n}</dd>
          </div>
          <div>
            <dt>Shapiro-Wilk W</dt>
            <dd>{formatStat(diagnostics.shapiroWilkW)}</dd>
          </div>
          <div>
            <dt>Shapiro-Wilk P</dt>
            <dd>{formatStat(diagnostics.shapiroWilkPValue)}</dd>
          </div>
          <div>
            <dt>Skewness</dt>
            <dd>{formatStat(diagnostics.skewness)}</dd>
          </div>
        </dl>
      )}

      {!error && diagnostics && diagnostics.n < 3 && (
        <p className="wizard-note">
          There isn't enough data in this group ({diagnostics.n} observation
          {diagnostics.n === 1 ? '' : 's'}) to compute a Shapiro-Wilk statistic or skewness (at
          least 3 observations are needed).
        </p>
      )}

      {!error && diagnostics && diagnostics.n >= 3 && diagnostics.n < SMALL_SAMPLE_THRESHOLD && (
        <p className="wizard-note">
          With this sample size (n = {diagnostics.n}), there is limited information for assessing
          the shape of the underlying population distribution. Treat the histogram and these
          numbers as a rough, informal check rather than a definitive one.
        </p>
      )}
    </div>
  )
}

/**
 * "Assumptions and checks": diagnostic-only normality information for each
 * group/condition. This NEVER controls which statistical test is used -
 * that decision was already made by the deterministic rules engine
 * (`src/rules/analysisRules.ts`), from the experiment design alone, before
 * this section's data even existed. It exists purely so a student can look
 * honestly at their data's shape.
 */
export function NormalityDiagnosticsSection({ groups }: NormalityDiagnosticsSectionProps) {
  return (
    <section aria-labelledby="assumptions-title">
      <h3 id="assumptions-title">Assumptions and checks</h3>
      <p>
        These diagnostics describe the shape of your data. They are shown for your information
        only - they never change which statistical test was used. The test was chosen by Rigor's
        rules engine from your experiment design, before any data existed, not from a normality
        p-value.
      </p>
      <p className="wizard-note">
        A Shapiro-Wilk p-value above 0.05 does not prove the data are normally distributed -
        it only means this sample didn't give strong evidence against normality. With small
        samples in particular, this test has limited power to detect a departure from normality
        even when one exists.
      </p>
      <div className="normality-groups">
        {groups.map((group) => (
          <GroupDiagnostics key={group.label} {...group} />
        ))}
      </div>
    </section>
  )
}
