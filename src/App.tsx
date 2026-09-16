import { useState } from 'react'
import { HomePage } from './app/HomePage'
import { WizardProvider } from './features/experiment-design/WizardProvider'
import { ExperimentDesignWizard } from './features/experiment-design/ExperimentDesignWizard'

type View = 'home' | 'wizard'

function App() {
  const [view, setView] = useState<View>('home')
  const [wizardKey, setWizardKey] = useState(0)

  function startAnalysis() {
    setWizardKey((key) => key + 1)
    setView('wizard')
  }

  return (
    <main>
      <h1>Rigor</h1>
      <p className="tagline">Statistics that start with your experiment.</p>

      {view === 'home' && <HomePage onStartAnalysis={startAnalysis} />}

      {view === 'wizard' && (
        <WizardProvider key={wizardKey}>
          <ExperimentDesignWizard onExit={() => setView('home')} />
        </WizardProvider>
      )}
    </main>
  )
}

export default App
