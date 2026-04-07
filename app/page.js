'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export default function DirectorsLensPro() {
  const [phase, setPhase] = useState('idle')       // idle | prelight | complete | error
  const [scene, setScene] = useState('')
  const [cinematographyPlan, setCinematographyPlan] = useState(null)
  const [fluxPrompt, setFluxPrompt] = useState('')
  const [takes, setTakes] = useState([])
  const [selectedTake, setSelectedTake] = useState(0)
  const [lockedSeed, setLockedSeed] = useState(null)
  const [error, setError] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [pollCount, setPollCount] = useState(0)

  const pollRef = useRef(null)
  const pendingIdsRef = useRef([])
  const pendingSeedsRef = useRef([])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (ids, seeds) => {
      setPollCount(0)
      pollRef.current = setInterval(async () => {
        try {
          setPollCount(c => c + 1)
          const params = new URLSearchParams({
            ids: ids.join(','),
            seeds: seeds.join(','),
          })
          const res = await fetch(`/api/status?${params}`)
          const data = await res.json()

          if (data.completed) {
            stopPolling()
            if (data.failed) {
              setError(data.error || 'Generation failed')
              setPhase('error')
            } else {
              setTakes(data.images)
              setSelectedTake(0)
              setPhase('complete')
            }
          }
        } catch (err) {
          console.error('Poll error:', err)
        }
      }, 3000)
    },
    [stopPolling]
  )

  useEffect(() => () => stopPolling(), [stopPolling])

  async function handleGenerate(overrideScene) {
    const sceneText = overrideScene ?? scene
    if (!sceneText.trim()) return

    stopPolling()
    setPhase('prelight')
    setError(null)
    setTakes([])
    setCinematographyPlan(null)
    setShowPrompt(false)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: sceneText,
          ...(lockedSeed != null ? { lockedSeed } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setCinematographyPlan(data.cinematographyPlan)
      setFluxPrompt(data.fluxPrompt)
      pendingIdsRef.current = data.predictionIds
      pendingSeedsRef.current = data.seeds
      startPolling(data.predictionIds, data.seeds)
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  function handleReset() {
    stopPolling()
    setPhase('idle')
    setScene('')
    setCinematographyPlan(null)
    setFluxPrompt('')
    setTakes([])
    setError(null)
    setLockedSeed(null)
    setShowPrompt(false)
    setPollCount(0)
  }

  const elapsedSec = pollCount * 3
  const elapsedDisplay =
    elapsedSec >= 60
      ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
      : `${elapsedSec}s`

  // ─── SHARED BUTTON STYLES ────────────────────────────────────────────────────
  const btnPrimary = (active = true) => ({
    background: active ? 'var(--accent)' : 'rgba(255,107,0,0.2)',
    color: active ? '#000' : 'rgba(255,255,255,0.3)',
    border: 'none',
    borderRadius: 3,
    padding: '14px 44px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '1.1rem',
    letterSpacing: '0.12em',
    cursor: active ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s',
  })

  const btnGhost = () => ({
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.4)',
    borderRadius: 3,
    padding: '14px 22px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '1.1rem',
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  return (
    <main style={{ minHeight: '100vh', paddingBottom: 100 }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '26px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 1240,
        margin: '0 auto',
      }}>
        <div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.9rem',
            letterSpacing: '0.12em',
            color: '#fff',
            lineHeight: 1,
          }}>
            VEFILM
            <span style={{ color: 'var(--accent)', marginLeft: 10 }}>DIRECTOR'S LENS PRO</span>
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.6rem',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.3)',
            marginTop: 5,
            textTransform: 'uppercase',
          }}>
            PEDRO FERIA PINO — AI CINEMATOGRAPHY SYSTEM
          </div>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.58rem',
          color: 'rgba(255,255,255,0.18)',
          letterSpacing: '0.1em',
          textAlign: 'right',
          lineHeight: 1.8,
        }}>
          GEMINI 2.5 FLASH<br />
          <span style={{ color: 'rgba(255,107,0,0.5)' }}>FLUX 1.1 PRO × 3</span>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '52px 40px 0' }}>

        {/* INTRO */}
        <div style={{ marginBottom: 52 }}>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(2.4rem, 4vw, 3.6rem)',
            letterSpacing: '0.06em',
            lineHeight: 1.05,
            marginBottom: 18,
          }}>
            DESCRIBE THE SHOT.<br />
            <span style={{ color: 'var(--accent)' }}>GET THREE TAKES. LOCK THE ONE.</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.95rem',
            lineHeight: 1.75,
            maxWidth: 660,
          }}>
            Gemini reads your scene and builds a full cinematography plan — film stock, focal length,
            light temperature, contrast ratio. Then FLUX renders three parallel takes using Pedro's
            visual DNA. Pick your frame. Lock the seed. Push into variations from that exact composition.
          </p>
        </div>

        {/* ── IDLE / ERROR — INPUT FORM ────────────────────────────────────────── */}
        {(phase === 'idle' || phase === 'error') && (
          <div style={{ marginBottom: 48 }}>

            {/* Seed status */}
            {lockedSeed != null && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(255,107,0,0.08)',
                border: '1px solid rgba(255,107,0,0.25)',
                borderRadius: 3,
                padding: '7px 14px',
                marginBottom: 16,
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem',
                  color: 'var(--accent)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  ◉ SEED LOCKED: {lockedSeed}
                </span>
                <button
                  onClick={() => setLockedSeed(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.58rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '0 0 0 6px',
                  }}
                >
                  UNLOCK
                </button>
              </div>
            )}

            <label style={{
              display: 'block',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.63rem',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              SCENE DESCRIPTION
            </label>

            <div style={{ position: 'relative' }}>
              <textarea
                value={scene}
                onChange={e => setScene(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
                }}
                placeholder={`Describe what you're seeing in the frame...\n\nExample: A detective stands at a rain-soaked window at 3am. The city lights blur through the glass. He hasn't slept in two days. There's a bottle of whiskey on the ledge. He's not drinking it yet.`}
                rows={7}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4,
                  color: '#fff',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.95rem',
                  lineHeight: 1.75,
                  padding: '18px 22px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(255,107,0,0.35)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <div style={{
                position: 'absolute',
                bottom: 14,
                right: 16,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.52rem',
                color: 'rgba(255,255,255,0.12)',
                letterSpacing: '0.1em',
                pointerEvents: 'none',
              }}>
                ⌘↵ TO GENERATE
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => handleGenerate()}
                disabled={!scene.trim()}
                style={btnPrimary(!!scene.trim())}
              >
                {lockedSeed != null ? 'REGENERATE — LOCKED SEED' : 'DIRECT THIS SHOT'}
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: 22,
                border: '1px solid rgba(255,60,60,0.25)',
                background: 'rgba(255,60,60,0.04)',
                borderRadius: 4,
                padding: '14px 18px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.72rem',
                color: '#ff7070',
                letterSpacing: '0.05em',
                lineHeight: 1.6,
              }}>
                ✕ {error}
              </div>
            )}
          </div>
        )}

        {/* ── PRE-LIGHT PHASE ──────────────────────────────────────────────────── */}
        {phase === 'prelight' && (
          <div style={{ marginBottom: 56, animation: 'fadeUp 0.35s ease' }}>

            {/* Status row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 36,
            }}>
              <div style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'pulse 1.2s ease-in-out infinite',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.63rem',
                letterSpacing: '0.18em',
                color: 'var(--accent)',
                textTransform: 'uppercase',
              }}>
                {cinematographyPlan
                  ? 'PRE-LIGHT COMPLETE — FLUX RENDERING 3 TAKES...'
                  : 'GEMINI — READING THE SCENE...'}
              </span>
              {elapsedSec > 0 && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.55rem',
                  color: 'rgba(255,255,255,0.18)',
                  marginLeft: 'auto',
                  letterSpacing: '0.08em',
                }}>
                  {elapsedDisplay}
                </span>
              )}
            </div>

            {/* Cinematography plan — shown as soon as Gemini returns */}
            {cinematographyPlan && (
              <>
                {/* Spec grid — 6 cells */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 1,
                  marginBottom: 1,
                }}>
                  {[
                    { label: 'FOCAL LENGTH', value: cinematographyPlan.focalLength, hi: true },
                    { label: 'FILM STOCK',   value: cinematographyPlan.filmStock,   hi: true },
                    { label: 'COLOR TEMP',   value: cinematographyPlan.colorTemp,   hi: false },
                    { label: 'CONTRAST',     value: cinematographyPlan.contrastRatio, hi: false },
                    { label: 'GRAIN',        value: cinematographyPlan.grain,       hi: false },
                    { label: 'MOOD',         value: cinematographyPlan.mood,        hi: false },
                  ].map(({ label, value, hi }) => (
                    <div key={label} style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      padding: '15px 18px',
                    }}>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.52rem',
                        letterSpacing: '0.2em',
                        color: 'rgba(255,255,255,0.25)',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.75rem',
                        color: hi ? 'var(--accent)' : 'rgba(255,255,255,0.65)',
                        lineHeight: 1.45,
                      }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lighting + Composition */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                  marginBottom: 36,
                }}
                  className="plan-grid"
                >
                  {[
                    { label: 'LIGHTING PLAN', value: cinematographyPlan.lightingPlan },
                    { label: 'COMPOSITION',   value: cinematographyPlan.composition },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: 'rgba(255,255,255,0.018)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '18px 20px',
                    }}>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.52rem',
                        letterSpacing: '0.2em',
                        color: 'rgba(255,255,255,0.22)',
                        textTransform: 'uppercase',
                        marginBottom: 10,
                      }}>
                        {label}
                      </div>
                      <p style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '0.88rem',
                        color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.75,
                        margin: 0,
                      }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Takes loading skeleton */}
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.58rem',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.18)',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}>
              TAKES — RENDERING
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  aspectRatio: '16 / 9',
                  background: 'rgba(255,255,255,0.018)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.58rem',
                    color: 'rgba(255,255,255,0.14)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}>
                    TAKE {i}
                  </div>
                  <div style={{
                    height: 2,
                    width: 28,
                    background: 'rgba(255,107,0,0.35)',
                    borderRadius: 1,
                    animation: `scanline 2s ease-in-out ${(i - 1) * 0.35}s infinite`,
                  }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COMPLETE — CONTACT SHEET ─────────────────────────────────────────── */}
        {phase === 'complete' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>

            {/* Header row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 28,
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.58rem',
                  letterSpacing: '0.18em',
                  color: 'rgba(255,255,255,0.22)',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}>
                  3 TAKES RENDERED
                </div>
                {lockedSeed != null && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.6rem',
                    color: 'var(--accent)',
                    letterSpacing: '0.1em',
                  }}>
                    ◉ SEED LOCKED: {lockedSeed}
                  </div>
                )}
              </div>
              <button onClick={handleReset} style={btnGhost()}>
                NEW SHOT
              </button>
            </div>

            {/* ── SELECTED TAKE — large frame ─────────────────────────────────── */}
            {takes[selectedTake] && (
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <img
                  src={takes[selectedTake].url}
                  alt={`Take ${selectedTake + 1}`}
                  style={{
                    width: '100%',
                    display: 'block',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                />

                {/* Corner frame marks */}
                {[
                  { top: 12, left: 12,  borderTop: true,  borderLeft: true  },
                  { top: 12, right: 12, borderTop: true,  borderRight: true },
                  { bottom: 12, left: 12,  borderBottom: true, borderLeft: true  },
                  { bottom: 12, right: 12, borderBottom: true, borderRight: true },
                ].map((pos, idx) => (
                  <div key={idx} style={{
                    position: 'absolute',
                    width: 18,
                    height: 18,
                    ...pos,
                    borderTop:    pos.borderTop    ? '1px solid rgba(255,107,0,0.4)' : 'none',
                    borderBottom: pos.borderBottom ? '1px solid rgba(255,107,0,0.4)' : 'none',
                    borderLeft:   pos.borderLeft   ? '1px solid rgba(255,107,0,0.4)' : 'none',
                    borderRight:  pos.borderRight  ? '1px solid rgba(255,107,0,0.4)' : 'none',
                    pointerEvents: 'none',
                  }} />
                ))}

                {/* Seed label */}
                <div style={{
                  position: 'absolute',
                  bottom: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.52rem',
                  color: 'rgba(255,255,255,0.22)',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  background: 'rgba(0,0,0,0.55)',
                  padding: '3px 12px',
                  borderRadius: 2,
                  pointerEvents: 'none',
                }}>
                  TAKE {selectedTake + 1} — SEED {takes[selectedTake].seed}
                </div>
              </div>
            )}

            {/* Action row */}
            <div style={{
              display: 'flex',
              gap: 10,
              marginBottom: 20,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              {takes[selectedTake] && (
                <>
                  <a
                    href={takes[selectedTake].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`vefilm-take${selectedTake + 1}-seed${takes[selectedTake].seed}.webp`}
                    style={{
                      ...btnPrimary(),
                      textDecoration: 'none',
                      display: 'inline-block',
                      padding: '11px 28px',
                      fontSize: '0.95rem',
                    }}
                  >
                    DOWNLOAD TAKE {selectedTake + 1}
                  </a>

                  <button
                    onClick={() => setLockedSeed(
                      lockedSeed === takes[selectedTake].seed ? null : takes[selectedTake].seed
                    )}
                    style={{
                      background: lockedSeed === takes[selectedTake].seed
                        ? 'rgba(255,107,0,0.12)'
                        : 'transparent',
                      border: `1px solid ${
                        lockedSeed === takes[selectedTake].seed
                          ? 'rgba(255,107,0,0.5)'
                          : 'rgba(255,255,255,0.12)'
                      }`,
                      color: lockedSeed === takes[selectedTake].seed
                        ? 'var(--accent)'
                        : 'rgba(255,255,255,0.4)',
                      borderRadius: 3,
                      padding: '11px 22px',
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: '0.95rem',
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {lockedSeed === takes[selectedTake].seed ? '◉ SEED LOCKED' : 'LOCK THIS SEED'}
                  </button>
                </>
              )}

              <button
                onClick={() => setShowPrompt(v => !v)}
                style={{ ...btnGhost(), padding: '11px 18px', fontSize: '0.95rem' }}
              >
                {showPrompt ? 'HIDE PROMPT' : 'VIEW PROMPT'}
              </button>
            </div>

            {/* ── CONTACT SHEET — 3 takes ─────────────────────────────────────── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              marginBottom: 36,
            }}>
              {takes.map((take, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedTake(i)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    border: `2px solid ${selectedTake === i ? 'var(--accent)' : 'transparent'}`,
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <img
                    src={take.url}
                    alt={`Take ${i + 1}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '28px 10px 8px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    pointerEvents: 'none',
                  }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.58rem',
                      color: selectedTake === i ? 'var(--accent)' : 'rgba(255,255,255,0.45)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      transition: 'color 0.15s',
                    }}>
                      TAKE {i + 1}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.48rem',
                      color: 'rgba(255,255,255,0.22)',
                      letterSpacing: '0.08em',
                    }}>
                      {take.seed}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cinematography plan summary */}
            {cinematographyPlan && (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 3,
                padding: '20px 24px',
                marginBottom: 20,
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.55rem',
                  letterSpacing: '0.2em',
                  color: 'rgba(255,255,255,0.2)',
                  textTransform: 'uppercase',
                  marginBottom: 16,
                }}>
                  CINEMATOGRAPHY PLAN
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 20,
                }}>
                  {[
                    ['LENS',    cinematographyPlan.focalLength],
                    ['FILM',    cinematographyPlan.filmStock],
                    ['TEMP',    cinematographyPlan.colorTemp],
                    ['CONTRAST', cinematographyPlan.contrastRatio],
                    ['GRAIN',   cinematographyPlan.grain],
                    ['MOOD',    cinematographyPlan.mood],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.5rem',
                        color: 'rgba(255,255,255,0.18)',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        marginBottom: 5,
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.7rem',
                        color: 'var(--accent)',
                        lineHeight: 1.4,
                      }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engineered prompt */}
            {showPrompt && (
              <div style={{
                border: '1px solid rgba(0,242,255,0.12)',
                background: 'rgba(0,242,255,0.015)',
                borderRadius: 3,
                padding: '20px 24px',
                marginBottom: 36,
                animation: 'fadeUp 0.3s ease',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.58rem',
                  letterSpacing: '0.18em',
                  color: 'var(--teal)',
                  textTransform: 'uppercase',
                  marginBottom: 14,
                }}>
                  GEMINI 2.5 FLASH — ENGINEERED PROMPT
                </div>
                <p style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                  color: 'rgba(255,255,255,0.48)',
                  lineHeight: 1.85,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}>
                  {fluxPrompt}
                </p>
              </div>
            )}

            {/* ── DIRECT ANOTHER SHOT ────────────────────────────────────────── */}
            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 36,
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.58rem',
                letterSpacing: '0.18em',
                color: 'rgba(255,255,255,0.22)',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}>
                {lockedSeed != null
                  ? `DIRECT ANOTHER SHOT — SEED ${lockedSeed} LOCKED`
                  : 'DIRECT ANOTHER SHOT'}
              </div>
              <textarea
                value={scene}
                onChange={e => setScene(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
                }}
                rows={4}
                placeholder="Describe the next shot..."
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  color: '#fff',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  padding: '14px 18px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: 14,
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(255,107,0,0.3)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleGenerate()}
                  disabled={!scene.trim()}
                  style={{ ...btnPrimary(!!scene.trim()), padding: '12px 36px', fontSize: '1rem' }}
                >
                  {lockedSeed != null ? 'REGENERATE — LOCKED SEED' : 'DIRECT THIS SHOT'}
                </button>
                {lockedSeed != null && (
                  <button
                    onClick={() => setLockedSeed(null)}
                    style={{ ...btnGhost(), padding: '12px 18px', fontSize: '0.85rem' }}
                  >
                    UNLOCK SEED
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────────────── */}
      <footer style={{
        maxWidth: 1240,
        margin: '80px auto 0',
        padding: '24px 40px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.58rem',
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          VEFILM © {new Date().getFullYear()} — PEDRO FERIA PINO
        </div>
        <a
          href="https://www.pedroferiapino.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.58rem',
            color: 'rgba(255,255,255,0.15)',
            letterSpacing: '0.12em',
            textDecoration: 'none',
            textTransform: 'uppercase',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.target.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.target.style.color = 'rgba(255,255,255,0.15)')}
        >
          PEDROFERIAPINO.COM
        </a>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1;   transform: scale(1);   }
          50%       { opacity: 0.3; transform: scale(0.65); }
        }
        @keyframes scanline {
          0%, 100% { width: 28px; opacity: 0.3; }
          50%       { width: 64px; opacity: 0.85; }
        }
        textarea::placeholder { color: rgba(255,255,255,0.16); }
        @media (max-width: 700px) {
          .plan-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
