import { useEffect, useState } from 'react'
import { HomePage } from './app/HomePage'
import { WizardProvider } from './features/experiment-design/WizardProvider'
import { ExperimentDesignWizard } from './features/experiment-design/ExperimentDesignWizard'
import { QuestionForkStep } from './features/experiment-design/QuestionForkStep'
import { DataImportFlow } from './features/data-import/DataImportFlow'
import { AnalysisFlow, type AnalysisReportContext } from './features/results/AnalysisFlow'
import { useAnalysisPlanAudit } from './features/results/useAnalysisPlanAudit'
import { buildReportContextFromProject } from './features/results/restoreReportContext'
import { CorrelationDesignFlow } from './features/correlation/CorrelationDesignFlow'
import { CorrelationDataEntry, type CorrelationDataReady } from './features/correlation/CorrelationDataEntry'
import { CorrelationFlow } from './features/correlation/CorrelationFlow'
import { ReportView } from './features/report/ReportView'
import type { Dataset } from './models/Dataset'
import type { ExperimentDesign } from './models/ExperimentDesign'
import type { CorrelationDesign } from './models/CorrelationDesign'
import type { ProjectAnalysisResult, RigorProject } from './models/ProjectFile'
import {
  buildRigorProject,
  deleteAutosavedProject,
  hasAutosavedProject as checkHasAutosavedProject,
  loadAutosavedProject,
  parseProjectFileText,
  saveAutosavedProject,
} from './storage/projectFiles'

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

  // Milestone 11: analysis-plan locking + the append-only audit trail. Lifted
  // up here (rather than owned locally by `AnalysisFlow`) so it survives
  // `AnalysisFlow` unmounting/remounting when the printable report is opened
  // and closed, and so `ReportView` can display it.
  const analysisPlanAudit = useAnalysisPlanAudit()

  // Milestone 10: correlation/regression is a separate, additive branch from
  // the fork below - it never touches `activeDesign`/`activeDataset`
  // (the group-comparison `ExperimentDesign`/`Dataset` state) above.
  const [correlationDesign, setCorrelationDesign] = useState<
    CorrelationDesign | undefined
  >(undefined)
  const [correlationData, setCorrelationData] = useState<
    CorrelationDataReady | undefined
  >(undefined)

  // --- Milestone 12: local persistence (IndexedDB autosave + reopen) --------
  const [hasAutosave, setHasAutosave] = useState(false)
  const [openProjectError, setOpenProjectError] = useState<string | undefined>(undefined)

  // On first load, check whether an autosaved project already exists in this
  // browser's IndexedDB, so the homepage can offer a real "Continue last
  // project" action instead of always assuming there is nothing to resume.
  useEffect(() => {
    void checkHasAutosavedProject().then(setHasAutosave)
  }, [])

  // Autosaves the design+dataset+lock-status+history "so far" on every
  // meaningful state transition - this effect re-runs whenever the active
  // design/dataset are set (i.e. after data import) or the audit history
  // changes (i.e. after locking, or after results are first reached) - never
  // on every keystroke, since none of those only change that often.
  useEffect(() => {
    if (!activeDesign || !activeDataset) return
    const project = buildRigorProject({
      experimentDesign: activeDesign,
      dataset: activeDataset,
      analysisHistory: analysisPlanAudit.history,
      appVersion: __APP_VERSION__,
    })
    void saveAutosavedProject(project).then(() => setHasAutosave(true))
  }, [activeDesign, activeDataset, analysisPlanAudit.history])

  /**
   * Restores full application state from a validated/migrated `RigorProject`
   * (from an uploaded file or the IndexedDB autosave) - the shared landing
   * point for both "Open saved project" and "Continue last project". When
   * the project already has a computed two-group analysis result, this
   * lands the student straight on the report view without recomputing
   * anything; otherwise it lands on the analysis flow, which computes
   * normally (nothing else in this version of Rigor persists a one-way-
   * ANOVA/categorical-association result - see `restoreReportContext.ts`).
   */
  function restoreProject(project: RigorProject) {
    setActiveDesign(project.experimentDesign)
    setActiveDataset(project.dataset)
    analysisPlanAudit.hydrate(project.analysisHistory, project.experimentDesign)

    const restoredReportContext = buildReportContextFromProject(project)
    if (restoredReportContext) {
      setReportContext(restoredReportContext)
      setView('report')
      return
    }
    setReportContext(undefined)
    setView('analysis')
  }

  function handleOpenProjectFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const result = parseProjectFileText(text)
      if (!result.ok) {
        setOpenProjectError(result.error)
        return
      }
      setOpenProjectError(undefined)
      restoreProject(result.project)
    }
    reader.onerror = () => {
      setOpenProjectError(`'${file.name}' couldn't be read. Please try again.`)
    }
    reader.readAsText(file)
  }

  function handleContinueLastProject() {
    void loadAutosavedProject().then((result) => {
      if (!result) {
        setOpenProjectError('No autosaved project was found in this browser.')
        return
      }
      if (!result.ok) {
        setOpenProjectError(result.error)
        return
      }
      setOpenProjectError(undefined)
      restoreProject(result.project)
    })
  }

  function handleDeleteLocalProjects() {
    void deleteAutosavedProject().then(() => setHasAutosave(false))
  }

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
    // A fresh design starts a brand-new analysis session - reset the
    // locking/audit trail from any previous one.
    analysisPlanAudit.reset()
    setView('data-import')
  }

  function dataImported(dataset: Dataset) {
    setActiveDataset(dataset)
    setView('analysis')
  }

  function openReport(context: AnalysisReportContext) {
    setReportContext(context)
    setView('report')

    // Milestone 12: opening the report is the point at which the fully
    // computed result becomes available at this level (see
    // `AnalysisReportContext`) - autosave it now, in addition to the
    // design/dataset/history autosave effect above, so "Continue last
    // project" can restore straight to this same report without
    // recomputing. Only the two-group shape is ever persisted (see
    // `ProjectFile.ts`/`restoreReportContext.ts`) - a one-way-ANOVA or
    // categorical-association report still autosaves design+dataset+history
    // via the effect above, just without a stored `analysis`.
    if (context.kind === 'two-group') {
      const analysisForProject: ProjectAnalysisResult = {
        analysisType: context.analysis.analysisType,
        result: context.analysis.result,
        groupALabel: context.groupALabel,
        groupBLabel: context.groupBLabel,
        normalityDiagnosticsByGroup: {
          ...(context.normalityA ? { [context.groupALabel]: context.normalityA } : {}),
          ...(context.normalityB ? { [context.groupBLabel]: context.normalityB } : {}),
        },
        aggregation: context.aggregation,
      }
      const project = buildRigorProject({
        experimentDesign: context.design,
        dataset: context.dataset,
        analysisHistory: analysisPlanAudit.history,
        analysis: analysisForProject,
        appVersion: __APP_VERSION__,
      })
      void saveAutosavedProject(project).then(() => setHasAutosave(true))
    }
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

      {view === 'home' && (
        <HomePage
          onStartAnalysis={startAnalysis}
          onOpenProjectFile={handleOpenProjectFile}
          openProjectError={openProjectError}
          hasAutosavedProject={hasAutosave}
          onContinueLastProject={handleContinueLastProject}
          onDeleteLocalProjects={handleDeleteLocalProjects}
        />
      )}

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
          auditHistory={analysisPlanAudit.history}
          isPlanLocked={analysisPlanAudit.isLocked}
          onLockPlan={analysisPlanAudit.lock}
          onResultsReached={analysisPlanAudit.markResultsReached}
          onExit={() => setView('home')}
          onOpenReport={openReport}
        />
      )}

      {view === 'report' && reportContext && (
        <ReportView
          context={reportContext}
          auditHistory={analysisPlanAudit.history}
          onClose={() => setView('analysis')}
        />
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
