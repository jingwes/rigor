export interface HomePageProps {
  onStartAnalysis: () => void
}

interface StubAction {
  label: string
  description: string
}

const STUB_ACTIONS: StubAction[] = [
  {
    label: 'Open saved project',
    description: "Saving and reopening projects isn't built yet.",
  },
  {
    label: 'Try example',
    description: "Worked examples aren't built yet.",
  },
  {
    label: 'Learn how this works',
    description: "A walkthrough of how Rigor works isn't written yet.",
  },
]

export function HomePage({ onStartAnalysis }: HomePageProps) {
  return (
    <div>
      <p>
        Rigor helps you describe an experiment in plain language before you think about how to
        analyze it. This early version covers describing your design - entering data and running
        an analysis come later.
      </p>

      <button type="button" className="primary-action" onClick={onStartAnalysis}>
        Start an analysis
      </button>

      <ul className="stub-actions">
        {STUB_ACTIONS.map((action) => (
          <li key={action.label}>
            <button type="button" disabled aria-disabled="true">
              {action.label}
            </button>
            <span className="coming-soon">Coming soon</span>
            <p className="option-examples">{action.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
