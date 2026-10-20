
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './Tracking.css'

const stages = [
  { value: 'pending', label: 'Request submitted', description: 'Your request is waiting for acceptance.' },
  { value: 'accepted', label: 'Request accepted', description: 'PickMe has accepted your request.' },
  { value: 'picked_up', label: 'Item picked up', description: 'Your item has been collected from the campus gate.' },
  { value: 'delivered', label: 'Delivered', description: 'Your delivery has been completed.' },
]

function Tracking() {
  const [reference, setReference] = useState(
    () => new URLSearchParams(window.location.search).get('ref') || '',
  )
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState(null)

  const lookupRequest = useCallback(async (code, showLoading = true) => {
    const cleanCode = code.trim().toUpperCase()

    if (!cleanCode) {
      setError('Enter your delivery reference code.')
      return
    }

    if (showLoading) setLoading(true)
    setError('')

    const { data, error: lookupError } = await supabase.rpc(
      'get_delivery_tracking',
      { p_reference_code: cleanCode },
    )

    if (lookupError) {
      setError('Tracking is temporarily unavailable. Please try again.')
      if (showLoading) setLoading(false)
      return
    }

    const result = Array.isArray(data) ? data[0] : data

    if (!result) {
      setRequest(null)
      setError('We could not find that reference code. Please check it and try again.')
    } else {
      setRequest(result)
      setReference(result.reference_code)
      setLastChecked(new Date())
      window.history.replaceState(
        {},
        '',
        `/track?ref=${encodeURIComponent(result.reference_code)}`,
      )
    }

    if (showLoading) setLoading(false)
  }, [])

  useEffect(() => {
    const initialCode = new URLSearchParams(window.location.search).get('ref')
    if (initialCode) lookupRequest(initialCode)
  }, [lookupRequest])

  useEffect(() => {
    if (!request) return undefined

    const timer = window.setInterval(() => {
      lookupRequest(request.reference_code, false)
    }, 15000)

    return () => window.clearInterval(timer)
  }, [request?.reference_code, lookupRequest])

  const currentStage = stages.findIndex(stage => stage.value === request?.status)

  return (
    <main className="tracking-page">
      <header className="tracking-header">
        <a href="/" className="tracking-brand">pickme<span>.</span></a>
        <a href="/">Back to home ↗</a>
      </header>

      <section className="tracking-content">
        <p className="tracking-eyebrow">PICKME DELIVERY TRACKING</p>
        <h1>Your delivery,<br />tracked.</h1>
        <p className="tracking-intro">
          Enter the reference code you received when you submitted your request.
        </p>

        <form
          className="tracking-search"
          onSubmit={event => {
            event.preventDefault()
            lookupRequest(reference)
          }}
        >
          <label htmlFor="tracking-reference">Reference code</label>
          <div className="tracking-search-row">
            <input
              id="tracking-reference"
              value={reference}
              onChange={event => setReference(event.target.value.toUpperCase())}
              placeholder="e.g. PM-VF64BJ"
              autoCapitalize="characters"
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Track →'}
            </button>
          </div>
        </form>

        {error && <p className="tracking-error" role="alert">{error}</p>}

        {request && (
          <section className="tracking-result" aria-live="polite">
            <div className="tracking-result-header">
              <div>
                <span className="tracking-muted">REFERENCE</span>
                <h2>{request.reference_code}</h2>
              </div>
              <span className={`tracking-badge tracking-${request.status}`}>
                {request.status.replace('_', ' ')}
              </span>
            </div>

            <div className="tracking-item-details">
              <div>
                <span>Item type</span>
                <strong>{request.item_type}</strong>
              </div>
              <div>
                <span>Delivering to</span>
                <strong>{request.hostel}</strong>
              </div>
            </div>

            <div className="tracking-progress">
              {stages.map((stage, index) => {
                const complete = currentStage >= index
                const active = currentStage === index

                return (
                  <div className={`tracking-step ${complete ? 'is-complete' : ''}`} key={stage.value}>
                    <div className="tracking-step-marker">
                      {complete ? '✓' : index + 1}
                    </div>
                    <div className="tracking-step-copy">
                      <strong>{stage.label}</strong>
                      <p>{stage.description}</p>
                      {active && <span className="tracking-current">CURRENT STATUS</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="tracking-updated">
              {lastChecked
                ? `Last checked at ${lastChecked.toLocaleTimeString()} · Updates automatically`
                : 'Checking latest status…'}
            </p>
          </section>
        )}
      </section>
    </main>
  )
}

export default Tracking
