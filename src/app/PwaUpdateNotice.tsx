import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Milestone 13 (PWA/offline support): a minimal, non-intrusive banner that
 * appears only when there's something to tell the student -
 * `vite-plugin-pwa`'s service worker has a new version ready, or (rarely
 * useful to call out, but cheap to add) the app just became available
 * offline for the first time. No functional change to the wizard/data/
 * statistics/results flow - this renders nothing at all in the common case.
 */
export function PwaUpdateNotice() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error) => {
      // Registration failures shouldn't be silent, but they also must never
      // block or alter the core statistics workflow - this is the extent of
      // handling they get.
      console.error('Service worker registration failed', error)
    },
  })

  if (!offlineReady && !needRefresh) return null

  function dismiss() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div role="status" className="pwa-update-notice">
      {needRefresh ? (
        <>
          <span>A new version of Rigor is available.</span>
          <button type="button" onClick={() => void updateServiceWorker(true)}>
            Refresh to update
          </button>
        </>
      ) : (
        <span>Rigor is ready to work offline.</span>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss">
        Dismiss
      </button>
    </div>
  )
}
