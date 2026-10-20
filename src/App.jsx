import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const services = [
  {
    number: '01',
    name: 'Food & drinks',
    description: 'Your order is at the gate. Dinner is still on.',
    symbol: '↗',
  },
  {
    number: '02',
    name: 'Parcels',
    description: 'Packages, deliveries, and things you need.',
    symbol: '□',
  },
  {
    number: '03',
    name: 'Printouts',
    description: 'Notes and assignments, right when you need them.',
    symbol: '▤',
  },
  {
    number: '04',
    name: 'Essentials',
    description: 'Everyday necessities, brought closer.',
    symbol: '+',
  },
]

const steps = [
  {
    number: '01',
    title: 'Place your request',
    text: 'Tell us what has arrived and where to collect it.',
  },
  {
    number: '02',
    title: 'We pick it up',
    text: 'Your delivery partner collects it from the campus gate.',
  },
  {
    number: '03',
    title: 'Meet at your hostel',
    text: 'Your order makes the final stretch to your hostel gate.',
  },
]

const initialForm = {
  itemType: 'Food & drinks',
  itemDescription: '',
  pickupLocation: 'SRM Campus Arch Gate',
  hostel: '',
  roomNumber: '',
  studentName: '',
  phone: '',
  instructions: '',
}

function generateReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length]
  }
  return `PM-${code}`
}

function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('pickme-theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      // Local storage may be unavailable.
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [requestNumber, setRequestNumber] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme

    try {
      localStorage.setItem('pickme-theme', theme)
    } catch {
      // The theme still works for this session.
    }
  }, [theme])

  useEffect(() => {
    if (!formOpen) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') closeForm()
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [formOpen])

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }

  function openForm(itemType) {
    setForm((current) => ({
      ...current,
      itemType: itemType || current.itemType,
    }))
    setSubmitted(false)
    setRequestNumber('')
    setSubmitError('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
  }

  function handleFieldChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitting) return

    setSubmitError('')

    const digits = form.phone.replace(/\D/g, '')

    if (digits.length !== 10) {
      setSubmitError('Please enter a valid 10-digit mobile number.')
      return
    }

    const reference = generateReference()

    const requestData = {
      reference_code: reference,
      student_name: form.studentName.trim(),
      phone: digits,
      item_type: form.itemType,
      item_description: form.itemDescription.trim(),
      pickup_location: 'SRM Campus Arch Gate',
      hostel: form.hostel.trim(),
      room_number: form.roomNumber.trim(),
      instructions: form.instructions.trim() || null,
      delivery_fee: 20,
      status: 'pending',
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('delivery_requests')
        .insert(requestData)

      if (error) {
        console.error('Delivery request failed:', error)

        const message = (error.message || '').toLowerCase()

        if (
          message.includes('orders are disabled for this phone number') ||
          message.includes('blacklisted')
        ) {
          setSubmitError(
            'This phone number cannot place new delivery requests. Please contact PickMe operations for assistance.'
          )
        } else if (message.includes('valid phone number is required')) {
          setSubmitError('Please enter a valid mobile number.')
        } else {
          setSubmitError(
            'We couldn’t submit your request right now. Please try again. If the problem continues, contact PickMe operations.'
          )
        }

        return
      }

      setRequestNumber(reference)
      setSubmitted(true)
    } catch (error) {
      console.error('Unexpected delivery request error:', error)
      setSubmitError(
        'Something went wrong while submitting your request. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <nav className="navbar">
        <a className="wordmark" href="#" aria-label="PickMe home">
          <img
            className="nav-logo"
            src="/pickme-logo.png"
            alt="PickMe Campus Delivery"
          />
          <span className="wordmark-text">
            pickme<span className="brand-period">.</span>
          </span>
        </a>

        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#services">What we deliver</a>
          <a href="#pricing">Pricing</a>
          <a href="/track">Track my delivery</a>
        </div>

        <div className="nav-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>

          <button
            className="nav-cta"
            type="button"
            onClick={() => openForm()}
          >
            Get a delivery <span>↗</span>
          </button>
        </div>
      </nav>

      <section className="hero" id="get-started">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            CAMPUS DELIVERY, SORTED
          </div>

          <h1>
            Your order made it.
            <br />
            We’ll take it <span>from here.</span>
          </h1>

          <p className="hero-description">
            Stuck at the campus gate? We’ll bring your food, parcels,
            printouts and essentials right to your hostel gate.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="button-primary"
              onClick={() => openForm()}
            >
              Get my delivery <span>↗</span>
            </button>

            <a href="#how-it-works" className="text-link">
              See how it works <span>↓</span>
            </a>
          </div>

          <div className="hero-proof">
            <div className="proof-icon">₹</div>
            <div>
              <strong>Flat ₹20 delivery fee</strong>
              <span>Item cost is separate. No surprises.</span>
            </div>
          </div>
        </div>

        <div
          className="hero-art"
          aria-label="Illustration of a campus delivery"
        >
          <div className="art-topline">
            <span>THE LAST STRETCH</span>
            <span>001 — 003</span>
          </div>

          <div className="campus-scene">
            <div className="sun" />
            <div className="cloud cloud-one" />
            <div className="cloud cloud-two" />

            <div className="building building-back">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="building building-front">
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="path" />

            <div className="person person-one">
              <i />
              <b />
              <em />
            </div>

            <div className="person person-two">
              <i />
              <b />
              <em />
            </div>

            <div className="delivery-bag">
              <img src="/pickme-logo.png" alt="PickMe delivery" />
            </div>

            <div className="scene-label label-gate">
              <span>01</span> CAMPUS GATE
            </div>

            <div className="scene-label label-hostel">
              <span>02</span> YOUR HOSTEL
            </div>
          </div>

          <div className="art-caption">
            <span>YOU’VE GOT PLACES TO BE.</span>
            <span>WE’VE GOT THE LAST MILE.</span>
          </div>
        </div>
      </section>

      <section className="service-section" id="services">
        <div className="section-heading">
          <div>
            <span className="eyebrow">WHAT CAN WE PICK UP?</span>
            <h2>
              The little things. <span>Handled.</span>
            </h2>
          </div>
          <p>Already ordered it? We’ll take care of getting it to you.</p>
        </div>

        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.number}>
              <div className="service-card-top">
                <span>{service.number} / SERVICE</span>
                <span className="service-symbol">{service.symbol}</span>
              </div>

              <h3>{service.name}</h3>
              <p>{service.description}</p>

              <button
                type="button"
                className="service-request-button"
                onClick={() => openForm(service.name)}
              >
                Request pickup <span>↗</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="process-section" id="how-it-works">
        <div className="process-intro">
          <span className="eyebrow">THREE STEPS. THAT’S IT.</span>
          <h2>
            From the gate
            <br />
            to <span>your doorstep.</span>
          </h2>
          <p>
            External deliveries stop at the campus gate. We handle the last
            stretch, so you don’t have to.
          </p>
        </div>

        <div className="steps-list">
          {steps.map((step) => (
            <article className="step" key={step.number}>
              <span className="step-number">{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
              <span className="step-arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div>
          <span className="eyebrow">SIMPLE, LIKE IT SHOULD BE</span>
          <h2>
            One short trip.
            <br />
            <span>One simple fee.</span>
          </h2>
        </div>

        <div className="price-block">
          <span className="price-label">PICKME DELIVERY FEE</span>
          <div className="price">
            ₹20<span>/ delivery</span>
          </div>
          <p>
            The cost of your order is paid separately to the original seller.
          </p>
          <button
            type="button"
            className="button-dark"
            onClick={() => openForm()}
          >
            Request a delivery <span>↗</span>
          </button>
        </div>
      </section>

      <footer className="footer">
        <a className="wordmark footer-wordmark" href="#" aria-label="PickMe home">
          <img className="footer-logo" src="/pickme-logo.png" alt="" />
          <span className="wordmark-text">
            pickme<span className="brand-period">.</span>
          </span>
        </a>

        <p>Your order made it. We’ll take it from here.</p>
        <span>MADE FOR CAMPUS LIFE.</span>
      </footer>

      {formOpen && (
        <div
          className="request-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm()
          }}
        >
          <section
            className="request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-title"
          >
            <button
              className="request-close"
              type="button"
              onClick={closeForm}
              aria-label="Close delivery request"
            >
              ×
            </button>

            {!submitted ? (
              <>
                <div className="request-modal-heading">
                  <span className="eyebrow">
                    <span className="status-dot" />
                    YOUR LAST-MILE DELIVERY
                  </span>
                  <h2 id="request-title">Let’s get it to you.</h2>
                  <p>
                    Tell us what’s waiting at the gate. We’ll handle the
                    last stretch.
                  </p>
                </div>

                <form className="request-form" onSubmit={handleSubmit}>
                  <div className="request-form-grid">
                    <label className="form-field">
                      <span>What are we picking up? *</span>
                      <select
                        name="itemType"
                        value={form.itemType}
                        onChange={handleFieldChange}
                        required
                      >
                        <option>Food & drinks</option>
                        <option>Parcels</option>
                        <option>Printouts</option>
                        <option>Essentials</option>
                        <option>Other</option>
                      </select>
                    </label>

                    <label className="form-field">
                      <span>Your name *</span>
                      <input
                        name="studentName"
                        value={form.studentName}
                        onChange={handleFieldChange}
                        placeholder="Full name"
                        autoComplete="name"
                        required
                      />
                    </label>

                    <label className="form-field form-field-full">
                      <span>Item / order details *</span>
                      <input
                        name="itemDescription"
                        value={form.itemDescription}
                        onChange={handleFieldChange}
                        placeholder="e.g. Food order from the delivery partner"
                        required
                      />
                    </label>

                    <label className="form-field form-field-full">
                      <span>Pickup location</span>
                      <input
                        name="pickupLocation"
                        value={form.pickupLocation}
                        readOnly
                        aria-readonly="true"
                      />
                      <small>
                        Your item should already be at this pickup point.
                      </small>
                    </label>

                    <label className="form-field">
                      <span>Hostel / residence *</span>
                      <input
                        name="hostel"
                        value={form.hostel}
                        onChange={handleFieldChange}
                        placeholder="Your hostel name"
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Room number *</span>
                      <input
                        name="roomNumber"
                        value={form.roomNumber}
                        onChange={handleFieldChange}
                        placeholder="Block and room"
                        required
                      />
                    </label>

                    <label className="form-field form-field-full">
                      <span>Mobile number *</span>
                      <input
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={handleFieldChange}
                        placeholder="10-digit mobile number"
                        pattern="[0-9+\s()-]{10,16}"
                        maxLength={16}
                        title="Enter your 10-digit mobile number"
                        required
                      />
                    </label>

                    <label className="form-field form-field-full">
                      <span>Additional instructions (optional)</span>
                      <textarea
                        name="instructions"
                        value={form.instructions}
                        onChange={handleFieldChange}
                        placeholder="Landmark, preferred meeting point, or other details"
                        rows={3}
                      />
                    </label>
                  </div>

                  {submitError && (
                    <div className="request-submit-error" role="alert">
                      <strong>Request not submitted</strong>
                      <p>{submitError}</p>
                    </div>
                  )}

                  <div className="request-fee">
                    <div>
                      <span>PickMe delivery fee</span>
                      <small>Original item cost is separate.</small>
                    </div>
                    <strong>₹20</strong>
                  </div>

                  <button
                    className="request-submit"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting…' : 'Submit delivery request'}{' '}
                    <span>↗</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="request-success">
                <div className="success-icon">✓</div>
                <span className="eyebrow">REQUEST RECEIVED</span>
                <h2 id="request-title">Looking good.</h2>
                <p>
                  Your delivery request has been saved. Keep your reference
                  number handy.
                </p>

                <div className="success-reference">
                  <span>REFERENCE</span>
                  <strong>{requestNumber}</strong>
                </div>

                <a
                  className="request-submit"
                  href={`/track?ref=${encodeURIComponent(requestNumber)}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textDecoration: 'none',
                    marginTop: '16px',
                  }}
                >
                  Track my delivery →
                </a>

                <div className="success-summary">
                  <div>
                    <span>Pickup</span>
                    <strong>{form.pickupLocation}</strong>
                  </div>
                  <div>
                    <span>Delivery to</span>
                    <strong>
                      {form.hostel}, Room {form.roomNumber}
                    </strong>
                  </div>
                  <div>
                    <span>Delivery fee</span>
                    <strong>₹20</strong>
                  </div>
                </div>

                <button
                  className="request-submit"
                  type="button"
                  onClick={() => {
                    setForm(initialForm)
                    setSubmitted(false)
                    setRequestNumber('')
                    setSubmitError('')
                    closeForm()
                  }}
                >
                  Back to PickMe
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default App