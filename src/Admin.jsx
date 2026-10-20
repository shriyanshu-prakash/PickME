import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './Admin.css'

const STATUSES = ['pending', 'accepted', 'picked_up', 'delivered']

function normalizePhone(value) {
  return value.replace(/\D/g, '')
}

function Admin() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [requests, setRequests] = useState([])
  const [blacklist, setBlacklist] = useState([])
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('Unpaid delivery')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [blacklistLoading, setBlacklistLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [blacklistBusy, setBlacklistBusy] = useState(false)
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
      setBlacklist([])
      setBlacklistLoading(true)
      return
    }

    let active = true

    async function loadDashboard() {
      setLoading(true)
      setBlacklistLoading(true)
      setError('')

      const { data: isAdmin, error: adminError } =
        await supabase.rpc('is_pickme_admin')

      if (!active) return

      if (adminError || isAdmin !== true) {
        setRequests([])
        setBlacklist([])
        setError(
          adminError
            ? `Could not verify admin access: ${adminError.message}`
            : 'This account is not authorized to administer PickMe.',
        )
        setBlacklistLoading(false)
        setLoading(false)
        return
      }

      const [ordersResult, blacklistResult] = await Promise.all([
        supabase
          .from('delivery_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('phone_blacklist')
          .select('phone, reason, created_at')
          .order('created_at', { ascending: false }),
      ])

      if (!active) return

      if (ordersResult.error) {
        setError(`Could not load requests: ${ordersResult.error.message}`)
      } else {
        setRequests(ordersResult.data ?? [])
      }

      if (blacklistResult.error) {
        setError(previous =>
          previous
            ? `${previous} | Could not load blacklist: ${blacklistResult.error.message}`
            : `Could not load blacklist: ${blacklistResult.error.message}`,
        )
      } else {
        setBlacklist(blacklistResult.data ?? [])
      }

      setBlacklistLoading(false)
      setLoading(false)
    }

    loadDashboard()

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
    setBlacklist([])
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
      .select('id, status, delivered_at')
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
        item.id === data.id
          ? {
              ...item,
              status: data.status,
              delivered_at: data.delivered_at ?? item.delivered_at,
            }
          : item,
      ),
    )

    setNotice(`Request ${request.reference_code} updated to ${nextStatus}.`)
    setBusyId(null)
  }

  async function addToBlacklist(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const normalizedPhone = normalizePhone(phone)

    if (normalizedPhone.length < 10) {
      setError('Enter a valid phone number with at least 10 digits.')
      return
    }

    setBlacklistBusy(true)

    const { data, error } = await supabase
      .from('phone_blacklist')
      .insert({
        phone: normalizedPhone,
        reason: reason.trim() || 'Unpaid delivery',
      })
      .select('phone, reason, created_at')
      .single()

    if (error) {
      setError(
        error.code === '23505'
          ? 'That phone number is already blacklisted.'
          : `Could not add number: ${error.message}`,
      )
      setBlacklistBusy(false)
      return
    }

    setBlacklist(current => [data, ...current])
    setPhone('')
    setReason('Unpaid delivery')
    setNotice(`Phone number ${normalizedPhone} has been blacklisted.`)
    setBlacklistBusy(false)
  }

  async function removeFromBlacklist(entry) {
    const confirmed = window.confirm(
      `Unblock ${entry.phone}? New orders from this number will be allowed again.`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')
    setBlacklistBusy(true)

    const { data, error } = await supabase
      .from('phone_blacklist')
      .delete()
      .eq('phone', entry.phone)
      .select('phone')
      .maybeSingle()

    if (error || !data) {
      setError(
        error
          ? `Could not unblock number: ${error.message}`
          : 'The number was not removed. Check your admin permissions.',
      )
      setBlacklistBusy(false)
      return
    }

    setBlacklist(current =>
      current.filter(item => item.phone !== entry.phone),
    )
    setNotice(`Phone number ${entry.phone} has been unblocked.`)
    setBlacklistBusy(false)
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
              <option value={status} key={status}>
                {status.replace('_', ' ')}
              </option>
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
                      <small>
                        {request.created_at
                          ? new Date(request.created_at).toLocaleString()
                          : ''}
                      </small>
                    </td>
                    <td>
                      {request.student_name}
                      <small>{request.phone}</small>
                    </td>
                    <td>
                      {request.item_type}
                      <small>{request.item_description}</small>
                    </td>
                    <td>
                      {request.hostel}
                      <small>Room {request.room_number}</small>
                    </td>
                    <td>
                      <span className={`admin-status status-${request.status}`}>
                        {request.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <select
                        value={request.status}
                        disabled={busyId === request.id}
                        onChange={event =>
                          updateStatus(request, event.target.value)
                        }
                        aria-label={`Update ${request.reference_code} status`}
                      >
                        {STATUSES.map(status => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section className="admin-blacklist">
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">PAYMENT & ACCOUNTABILITY</p>
              <h2>Phone blacklist</h2>
              <p>
                Block new delivery requests from numbers with outstanding
                payments. Existing requests are not automatically cancelled.
              </p>
            </div>
            <span className="admin-blacklist-count">
              {blacklist.length} blocked
            </span>
          </div>

          <form className="admin-blacklist-form" onSubmit={addToBlacklist}>
            <label>
              Phone number
              <input
                type="tel"
                inputMode="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                required
              />
            </label>
            <label>
              Reason
              <input
                type="text"
                placeholder="Reason for blocking"
                value={reason}
                onChange={event => setReason(event.target.value)}
                maxLength={200}
              />
            </label>
            <button
              className="admin-primary-button"
              type="submit"
              disabled={blacklistBusy}
            >
              {blacklistBusy ? 'Please wait…' : '+ Block number'}
            </button>
          </form>

          {blacklistLoading ? (
            <p>Loading blacklist…</p>
          ) : blacklist.length === 0 ? (
            <div className="admin-empty">
              No phone numbers are currently blacklisted.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Phone number</th>
                    <th>Reason</th>
                    <th>Added</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {blacklist.map(entry => (
                    <tr key={entry.phone}>
                      <td><strong>{entry.phone}</strong></td>
                      <td>{entry.reason}</td>
                      <td>
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleString()
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-secondary-button"
                          disabled={blacklistBusy}
                          onClick={() => removeFromBlacklist(entry)}
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="admin-privacy-note">
          Request details are for authorized PickMe operations only.
        </p>
      </section>
    </main>
  )
}

export default Admin