import { useState } from 'react'
import { HomePage } from './app/HomePage'
import { WizardProvider } from './features/experiment-design/WizardProvider'
import { ExperimentDesignWizard } from './features/experiment-design/ExperimentDesignWizard'
import { DataImportFlow } from './features/data-import/DataImportFlow'
import type { ExperimentDesign } from './models/ExperimentDesign'

type View = 'home' | 'wizard' | 'data-import'

function App() {
  const [view, setView] = useState<View>('home')
  const [wizardKey, setWizardKey] = useState(0)
  const [activeDesign, setActiveDesign] = useState<
    ExperimentDesign | undefined
  >(undefined)

  function startAnalysis() {
    setWizardKey((key) => key + 1)
    setView('wizard')
  }

  function enterData(design: ExperimentDesign) {
    setActiveDesign(design)
    setView('data-import')
  }

  return (
    <main>
      <h1>Rigor</h1>
      <p className="tagline">Statistics that start with your experiment.</p>

      {view === 'home' && <HomePage onStartAnalysis={startAnalysis} />}

      {view === 'wizard' && (
        <WizardProvider key={wizardKey}>
          <ExperimentDesignWizard
            onExit={() => setView('home')}
            onEnterData={enterData}
          />
        </WizardProvider>
      )}

      {view === 'data-import' && activeDesign && (
        <DataImportFlow design={activeDesign} onExit={() => setView('home')} />
      )}
    </main>
  )
}

export default App
