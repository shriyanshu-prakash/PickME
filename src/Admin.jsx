import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './Admin.css'

const STATUSES = ['pending', 'accepted', 'picked_up', 'delivered']

function Admin() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [requests, setRequests] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      setSession(data?.session ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setError('')
      },
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setRequests([])
      return
    }

    let active = true

    async function loadRequests() {
      setLoading(true)
      setError('')

      const { data, error } = await supabase.rpc('is_pickme_admin')

      if (!active) return

      if (error || data !== true) {
        setRequests([])
        setError(
          error
            ? `Could not verify admin access: ${error.message}`
            : 'This account is not authorized to administer PickMe.',
        )
        setLoading(false)
        return
      }

      const result = await supabase
        .from('delivery_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (!active) return

      if (result.error) {
        setError(`Could not load requests: ${result.error.message}`)
      } else {
        setRequests(result.data ?? [])
      }

      setLoading(false)
    }

    loadRequests()

    return () => {
      active = false
    }
  }, [session])

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError(error.message)
      return
    }

    setSession(data.session)
    setPassword('')
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    setSession(null)
    setRequests([])
    setNotice('')
  }

  async function updateStatus(request, nextStatus) {
    if (!STATUSES.includes(nextStatus)) return

    setBusyId(request.id)
    setError('')
    setNotice('')

    const { data, error } = await supabase
      .from('delivery_requests')
      .update({ status: nextStatus })
      .eq('id', request.id)
      .select('id, status')
      .maybeSingle()

    if (error || !data) {
      setError(
        error
          ? `Status update failed: ${error.message}`
          : 'No request was updated. Check your admin permissions.',
      )
      setBusyId(null)
      return
    }

    setRequests(current =>
      current.map(item =>
        item.id === data.id ? { ...item, status: data.status } : item,
      ),
    )

    setNotice(`Request ${request.reference_code} updated to ${nextStatus}.`)
    setBusyId(null)
  }

  const filteredRequests = requests.filter(request => {
    const matchesSearch = [
      request.reference_code,
      request.student_name,
      request.phone,
    ].some(value =>
      String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()),
    )

    return (
      matchesSearch &&
      (statusFilter === 'all' || request.status === statusFilter)
    )
  })

  const countFor = status =>
    requests.filter(request => request.status === status).length

  if (loading && !session) {
    return <main className="admin-page"><p>Loading PickMe Admin…</p></main>
  }

  if (!session) {
    return (
      <main className="admin-page">
        <section className="admin-login">
          <a className="admin-brand" href="/">pickme<span>.</span></a>
          <p className="admin-eyebrow">CAMPUS DELIVERY OPERATIONS</p>
          <h1>Admin sign in</h1>
          <p>Sign in with your authorized PickMe administrator account.</p>

          <form onSubmit={handleLogin} className="admin-login-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" className="admin-primary-button">
              Sign in →
            </button>
          </form>

          {error && <p className="admin-error" role="alert">{error}</p>}
          <a className="admin-back-link" href="/">← Back to PickMe</a>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="admin-brand" href="/">pickme<span>.</span></a>
        <div className="admin-header-right">
          <span>{session.user.email}</span>
          <button className="admin-secondary-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <section className="admin-content">
        <div className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">CAMPUS DELIVERY OPERATIONS</p>
            <h1>Delivery requests</h1>
            <p>Track incoming requests and manage their progress.</p>
          </div>
          <button
            className="admin-secondary-button"
            onClick={() => window.location.reload()}
          >
            ↻ Refresh
          </button>
        </div>

        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}

        <div className="admin-stats">
          <article><span>Total loaded</span><strong>{requests.length}</strong></article>
          <article><span>Pending</span><strong>{countFor('pending')}</strong></article>
          <article><span>Accepted</span><strong>{countFor('accepted')}</strong></article>
          <article><span>Picked up</span><strong>{countFor('picked_up')}</strong></article>
          <article><span>Delivered</span><strong>{countFor('delivered')}</strong></article>
        </div>

        <div className="admin-toolbar">
          <input
            type="search"
            placeholder="Search reference, name, or phone…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            aria-label="Search delivery requests"
          />
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUSES.map(status => (
              <option value={status} key={status}>{status.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Loading requests…</p>
        ) : filteredRequests.length === 0 ? (
          <div className="admin-empty">No matching delivery requests.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Student</th>
                  <th>Item</th>
                  <th>Delivery destination</th>
                  <th>Status</th>
                  <th>Update status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(request => (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.reference_code}</strong>
                      <small>{request.created_at ? new Date(request.created_at).toLocaleString() : ''}</small>
                    </td>
                    <td>{request.student_name}<small>{request.phone}</small></td>
                    <td>{request.item_type}<small>{request.item_description}</small></td>
                    <td>{request.hostel}<small>Room {request.room_number}</small></td>
                    <td><span className={`admin-status status-${request.status}`}>{request.status?.replace('_', ' ')}</span></td>
                    <td>
                      <select
                        value={request.status}
                        disabled={busyId === request.id}
                        onChange={event => updateStatus(request, event.target.value)}
                        aria-label={`Update ${request.reference_code} status`}
                      >
                        {STATUSES.map(status => (
                          <option key={status} value={status}>{status.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="admin-privacy-note">
          Request details are for authorized PickMe operations only.
        </p>
      </section>
    </main>
  )
}

export default Admin