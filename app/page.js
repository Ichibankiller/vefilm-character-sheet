'use client'

import { useState, useRef } from 'react'

export default function CharacterSheetGenerator() {
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [progress, setProgress] = useState(0)

  const fileInputRef = useRef(null)
  const progressRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function startMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('Voice input not supported. Use Chrome or Edge.')
      return
    }
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    setIsListening(true)
    recognition.onresult = (e) => {
      setDescription(e.results[0][0].transcript)
      setIsListening(false)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  function startProgressAnimation() {
    setProgress(0)
    let p = 0
    const interval = setInterval(() => {
      // Fast to 40%, then slow crawl — real generation takes 30-60s
      if (p < 40) p += 2
      else if (p < 75) p += 0.4
      else if (p < 90) p += 0.1
      setProgress(Math.min(p, 90))
    }, 600)
    return interval
  }

  async function handleGenerate() {
    if (!description && !imageFile) {
      setError('Add a description or upload a reference image to continue.')
      return
    }
    setIsGenerating(true)
    setError(null)
    setResult(null)
    setShowPrompt(false)

    const progressInterval = startProgressAnimation()

    try {
      let imageBase64 = null
      let imageMimeType = null

      if (imageFile) {
        const buffer = await imageFile.arrayBuffer()
        imageBase64 = Buffer.from(buffer).toString('base64')
        imageMimeType = imageFile.type
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterDescription: description,
          imageBase64,
          imageMimeType,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Generation failed')

      clearInterval(progressInterval)
      setProgress(100)
      setResult(data)
    } catch (err) {
      clearInterval(progressInterval)
      setProgress(0)
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  function handleReset() {
    setDescription('')
    setImageFile(null)
    setImagePreview(null)
    setResult(null)
    setError(null)
    setShowPrompt(false)
    setProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <main style={{ minHeight: '100vh', padding: '0 0 80px 0' }}>

      {/* ── HEADER ── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 960,
        margin: '0 auto',
      }}>
        <div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '2rem',
            letterSpacing: '0.12em',
            color: '#fff',
            lineHeight: 1,
          }}>
            VEFILM
            <span style={{ color: 'var(--accent)', marginLeft: 10 }}>CHARACTER SHEET</span>
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.62rem',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.35)',
            marginTop: 4,
            textTransform: 'uppercase',
          }}>
            PEDRO FERIA PINO — AI SYSTEMS / PRODUCTION PIPELINE
          </div>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.1em',
          textAlign: 'right',
        }}>
          GEMINI 2.5 FLASH<br />
          <span style={{ color: 'var(--accent)' }}>FLUX 1.1 PRO</span>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 32px 0' }}>

        {/* INTRO */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '3.2rem',
            letterSpacing: '0.06em',
            lineHeight: 1.05,
            marginBottom: 16,
          }}>
            ONE IMAGE IN.<br />
            <span style={{ color: 'var(--accent)' }}>A COMPLETE CHARACTER BIBLE OUT.</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '0.95rem',
            lineHeight: 1.7,
            maxWidth: 620,
          }}>
            Upload a single reference image or describe your character in detail.
            Gemini 2.5 Flash engineers a production-grade prompt — then FLUX 1.1 Pro renders
            a full photorealistic multi-view character consistency sheet. Front. 3/4. Profile. Detail.
            One sheet. Every angle locked.
          </p>
        </div>

        {/* ── INPUT GRID ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          marginBottom: 32,
        }}
          className="input-grid"
        >

          {/* LEFT — IMAGE UPLOAD */}
          <div>
            <label style={{
              display: 'block',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.65rem',
              letterSpacing: '0.18em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              REFERENCE IMAGE (OPTIONAL)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              style={{
                border: `1px dashed ${imagePreview ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 4,
                minHeight: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                position: 'relative',
                transition: 'border-color 0.2s',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Reference"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageFile(null)
                      setImagePreview(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(0,0,0,0.75)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      borderRadius: 3,
                      padding: '3px 8px',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    REMOVE
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 10, opacity: 0.3 }}>⊕</div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}>
                    DRAG & DROP OR CLICK<br />
                    <span style={{ color: 'rgba(255,255,255,0.15)' }}>JPG / PNG / WEBP</span>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* RIGHT — TEXT DESCRIPTION */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{
              display: 'block',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.65rem',
              letterSpacing: '0.18em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              CHARACTER DESCRIPTION
            </label>
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Physical traits, age, build, wardrobe, hair, distinguishing features...\n\nExample: Male, late 30s, weathered face, deep-set green eyes, 3-day stubble, scar through left eyebrow. Wearing a worn brown canvas jacket, black turtleneck. Heavy. Tired. Like he's been running from something for years.`}
                style={{
                  flex: 1,
                  minHeight: 200,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4,
                  color: '#fff',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  padding: '14px 44px 14px 14px',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(255,107,0,0.4)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              {/* MIC BUTTON */}
              <button
                onClick={startMic}
                title="Speak your description"
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: isListening ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isListening ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 4,
                  color: isListening ? '#000' : 'rgba(255,255,255,0.5)',
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  animation: isListening ? 'blink 0.8s ease-in-out infinite' : 'none',
                }}
              >
                🎤
              </button>
            </div>
            {isListening && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.6rem',
                color: 'var(--accent)',
                letterSpacing: '0.15em',
                marginTop: 6,
                textTransform: 'uppercase',
              }}>
                ● LISTENING...
              </div>
            )}
          </div>
        </div>

        {/* ── GENERATE BUTTON ── */}
        <div style={{ marginBottom: 40 }}>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              background: isGenerating ? 'rgba(255,107,0,0.3)' : 'var(--accent)',
              color: isGenerating ? 'rgba(255,255,255,0.5)' : '#000',
              border: 'none',
              borderRadius: 3,
              padding: '16px 48px',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '1.15rem',
              letterSpacing: '0.12em',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginRight: 12,
            }}
          >
            {isGenerating ? 'GENERATING...' : 'GENERATE CHARACTER SHEET'}
          </button>
          {(result || error) && (
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.4)',
                borderRadius: 3,
                padding: '16px 28px',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '1.15rem',
                letterSpacing: '0.12em',
                cursor: 'pointer',
              }}
            >
              RESET
            </button>
          )}
        </div>

        {/* ── PROGRESS BAR ── */}
        {isGenerating && (
          <div style={{ marginBottom: 32 }}>
            <div style={{
              height: 2,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 8,
            }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--teal))',
                  transition: 'width 0.6s ease',
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="loader-text">
                {progress < 30
                  ? 'GEMINI ENGINEERING PROMPT...'
                  : progress < 70
                  ? 'FLUX 1.1 PRO RENDERING...'
                  : 'FINALIZING CHARACTER SHEET...'}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.25)',
              }}>
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div style={{
            border: '1px solid rgba(255,60,60,0.3)',
            background: 'rgba(255,60,60,0.05)',
            borderRadius: 4,
            padding: '16px 20px',
            marginBottom: 32,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            color: '#ff6b6b',
            letterSpacing: '0.05em',
          }}>
            ✕ ERROR — {error}
          </div>
        )}

        {/* ── RESULT ── */}
        {result && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>

            {/* Output label */}
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.62rem',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.25)',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}>
              CHARACTER REFERENCE SHEET — OUTPUT
            </div>

            {/* The image */}
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 20,
              position: 'relative',
            }}>
              <img
                src={result.imageUrl}
                alt="Character Sheet"
                style={{ width: '100%', display: 'block' }}
              />
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <a
                href={result.imageUrl}
                download="character-sheet.webp"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 3,
                  padding: '11px 28px',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '1rem',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                DOWNLOAD SHEET
              </a>
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.4)',
                  borderRadius: 3,
                  padding: '11px 28px',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '1rem',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                {showPrompt ? 'HIDE PROMPT' : 'VIEW ENGINEERED PROMPT'}
              </button>
            </div>

            {/* Engineered prompt reveal */}
            {showPrompt && (
              <div style={{
                border: '1px solid rgba(0,242,255,0.15)',
                background: 'rgba(0,242,255,0.02)',
                borderRadius: 4,
                padding: '20px 24px',
                marginBottom: 32,
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.6rem',
                  letterSpacing: '0.18em',
                  color: 'var(--teal)',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}>
                  GEMINI 2.5 FLASH — ENGINEERED PROMPT
                </div>
                <p style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.55)',
                  lineHeight: 1.7,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}>
                  {result.engineeredPrompt}
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        maxWidth: 960,
        margin: '80px auto 0',
        padding: '24px 32px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.18)',
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
            fontSize: '0.6rem',
            color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.12em',
            textDecoration: 'none',
            textTransform: 'uppercase',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.color = 'var(--accent)'}
          onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.18)'}
        >
          PEDROFERIAPINO.COM
        </a>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 680px) {
          .input-grid {
            grid-template-columns: 1fr !important;
          }
        }
        textarea::placeholder {
          color: rgba(255,255,255,0.18);
        }
      `}</style>
    </main>
  )
}
