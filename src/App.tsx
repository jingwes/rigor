import { useState } from 'react'
import { HomePage } from './app/HomePage'
import { WizardProvider } from './features/experiment-design/WizardProvider'
import { ExperimentDesignWizard } from './features/experiment-design/ExperimentDesignWizard'
import { DataImportFlow } from './features/data-import/DataImportFlow'
import { AnalysisFlow, type AnalysisReportContext } from './features/results/AnalysisFlow'
import { ReportView } from './features/report/ReportView'
import type { Dataset } from './models/Dataset'
import type { ExperimentDesign } from './models/ExperimentDesign'

type View = 'home' | 'wizard' | 'data-import' | 'analysis' | 'report'

function App() {
  const [view, setView] = useState<View>('home')
  const [wizardKey, setWizardKey] = useState(0)
  const [activeDesign, setActiveDesign] = useState<
    ExperimentDesign | undefined
  >(undefined)
  const [activeDataset, setActiveDataset] = useState<Dataset | undefined>(
    undefined,
  )
  const [reportContext, setReportContext] = useState<
    AnalysisReportContext | undefined
  >(undefined)

  function startAnalysis() {
    setWizardKey((key) => key + 1)
    setView('wizard')
  }

  function enterData(design: ExperimentDesign) {
    setActiveDesign(design)
    setView('data-import')
  }

  function dataImported(dataset: Dataset) {
    setActiveDataset(dataset)
    setView('analysis')
  }

  function openReport(context: AnalysisReportContext) {
    setReportContext(context)
    setView('report')
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
        <DataImportFlow
          design={activeDesign}
          onExit={() => setView('home')}
          onDataImported={dataImported}
        />
      )}

      {view === 'analysis' && activeDesign && activeDataset && (
        <AnalysisFlow
          design={activeDesign}
          dataset={activeDataset}
          onExit={() => setView('home')}
          onOpenReport={openReport}
        />
      )}

      {view === 'report' && reportContext && (
        <ReportView context={reportContext} onClose={() => setView('analysis')} />
      )}
    </main>
  )
}

export default App
