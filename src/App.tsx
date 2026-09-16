import { useState } from 'react'
import { HomePage } from './app/HomePage'
import { WizardProvider } from './features/experiment-design/WizardProvider'
import { ExperimentDesignWizard } from './features/experiment-design/ExperimentDesignWizard'
import { QuestionForkStep } from './features/experiment-design/QuestionForkStep'
import { DataImportFlow } from './features/data-import/DataImportFlow'
import { AnalysisFlow, type AnalysisReportContext } from './features/results/AnalysisFlow'
import { CorrelationDesignFlow } from './features/correlation/CorrelationDesignFlow'
import { CorrelationDataEntry, type CorrelationDataReady } from './features/correlation/CorrelationDataEntry'
import { CorrelationFlow } from './features/correlation/CorrelationFlow'
import { ReportView } from './features/report/ReportView'
import type { Dataset } from './models/Dataset'
import type { ExperimentDesign } from './models/ExperimentDesign'
import type { CorrelationDesign } from './models/CorrelationDesign'

type View =
  | 'home'
  | 'question-fork'
  | 'wizard'
  | 'data-import'
  | 'analysis'
  | 'report'
  | 'correlation-design'
  | 'correlation-data'
  | 'correlation-results'

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

  // Milestone 10: correlation/regression is a separate, additive branch from
  // the fork below - it never touches `activeDesign`/`activeDataset`
  // (the group-comparison `ExperimentDesign`/`Dataset` state) above.
  const [correlationDesign, setCorrelationDesign] = useState<
    CorrelationDesign | undefined
  >(undefined)
  const [correlationData, setCorrelationData] = useState<
    CorrelationDataReady | undefined
  >(undefined)

  function startAnalysis() {
    setView('question-fork')
  }

  function startGroupComparisonWizard() {
    setWizardKey((key) => key + 1)
    setView('wizard')
  }

  function startCorrelationFlow() {
    setView('correlation-design')
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

  function correlationDesignComplete(design: CorrelationDesign) {
    setCorrelationDesign(design)
    setView('correlation-data')
  }

  function correlationDataReady(data: CorrelationDataReady) {
    setCorrelationData(data)
    setView('correlation-results')
  }

  return (
    <main>
      <h1>Rigor</h1>
      <p className="tagline">Statistics that start with your experiment.</p>

      {view === 'home' && <HomePage onStartAnalysis={startAnalysis} />}

      {view === 'question-fork' && (
        <QuestionForkStep
          onChooseGroupComparison={startGroupComparisonWizard}
          onChooseCorrelation={startCorrelationFlow}
          onExit={() => setView('home')}
        />
      )}

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

      {view === 'correlation-design' && (
        <CorrelationDesignFlow
          onExit={() => setView('home')}
          onComplete={correlationDesignComplete}
        />
      )}

      {view === 'correlation-data' && correlationDesign && (
        <CorrelationDataEntry
          design={correlationDesign}
          onExit={() => setView('correlation-design')}
          onDataReady={correlationDataReady}
        />
      )}

      {view === 'correlation-results' && correlationDesign && correlationData && (
        <CorrelationFlow
          design={correlationDesign}
          data={correlationData}
          onExit={() => setView('home')}
        />
      )}
    </main>
  )
}

export default App
