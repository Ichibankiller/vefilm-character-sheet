import { GoogleGenAI } from '@google/genai'
import Replicate from 'replicate'
import sharp from 'sharp'

// Allow up to 300s — parallel FLUX generations take 45-90s
export const maxDuration = 300

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// Panel definitions — each gets its own FLUX call
const PANELS = [
  {
    label: 'FRONT',
    viewInstruction: 'Full body, facing directly toward camera, standing neutral, arms at sides, feet shoulder-width apart.',
    aspect_ratio: '2:3',
    row: 0,
  },
  {
    label: '3/4 VIEW',
    viewInstruction: 'Full body, three-quarter angle, body rotated 45 degrees to the right, face angled slightly toward camera.',
    aspect_ratio: '2:3',
    row: 0,
  },
  {
    label: 'PROFILE',
    viewInstruction: 'Full body, strict side profile, facing right, head and body in true 90-degree profile.',
    aspect_ratio: '2:3',
    row: 0,
  },
  {
    label: 'BACK',
    viewInstruction: 'Full body, facing directly away from camera, back view, standing neutral.',
    aspect_ratio: '2:3',
    row: 0,
  },
  {
    label: 'FACE FRONT',
    viewInstruction: 'Head and shoulders close-up portrait, face directly forward, neutral expression.',
    aspect_ratio: '1:1',
    row: 1,
  },
  {
    label: 'FACE 3/4',
    viewInstruction: 'Head and shoulders close-up portrait, face at three-quarter angle, turned slightly right.',
    aspect_ratio: '1:1',
    row: 1,
  },
  {
    label: 'FACE PROFILE',
    viewInstruction: 'Head and shoulders close-up portrait, strict side profile facing right.',
    aspect_ratio: '1:1',
    row: 1,
  },
]

async function runFlux(replicate, basePrompt, panel, seed) {
  const panelPrompt = `${basePrompt} ${panel.viewInstruction} Single photograph, no collage, no multiple people, one person only.`

  const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
    input: {
      prompt: panelPrompt,
      aspect_ratio: panel.aspect_ratio,
      output_format: 'webp',
      output_quality: 90,
      safety_tolerance: 2,
      prompt_upsampling: true,
      seed,
    },
  })

  const raw = Array.isArray(output) ? output[0] : output
  return typeof raw === 'string' ? raw : (raw?.url?.() ?? String(raw))
}

async function fetchImageBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { characterDescription, imageBase64, imageMimeType } = body

    if (!characterDescription && !imageBase64) {
      return Response.json({ error: 'Character description or image is required' }, { status: 400 })
    }

    // ─── STEP 1: GEMINI — EXTRACT CHARACTER DETAIL ────────────────────────────
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const systemPrompt = `You are a technical prompt writer for professional film production. Output ONLY raw descriptive text — nothing else.

ABSOLUTE RULES:
- Output ONLY the character description. No preamble. No markdown. No "Here is". No asterisks. No headers.
- One continuous paragraph. Start immediately with a descriptive word about the person.

Describe this character with extreme precision for a casting/costume/makeup brief:
- Age (specific range), ethnicity, skin tone (specific)
- Face shape, jaw, cheekbones, nose shape, lip shape, forehead
- Eye color and shape exactly
- Hair: exact color, texture, length, styling
- Facial hair: exact coverage, density, color
- Distinguishing features: scars, moles, freckles, glasses (frame style+color), piercings, tattoos
- Build: height impression, weight, posture, muscle tone
- Every garment: fabric, color, fit, condition, wear
- Footwear: exact style, color, condition
- Overall bearing: how this person stands and carries themselves`

    let geminiContent = []
    if (imageBase64) {
      geminiContent.push({ inlineData: { data: imageBase64, mimeType: imageMimeType || 'image/jpeg' } })
    }
    geminiContent.push({
      text: imageBase64
        ? 'Extract every precise physical detail from this reference image. Output only the character description — no preamble, start immediately with descriptive text.'
        : `Write a precise physical description of: ${characterDescription}. Output only the character description — no preamble, start immediately with descriptive text.`,
    })

    const geminiResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: geminiContent }],
      systemInstruction: systemPrompt,
    })

    let characterDetail = geminiResponse.candidates[0].content.parts[0].text.trim()
    // Strip any preamble Gemini sneaks in
    characterDetail = characterDetail
      .replace(/^\*\*[^*]+\*\*\s*/i, '')
      .replace(/^Here'?s?\s+[^:]+:\s*/i, '')
      .replace(/^Prompt:\s*/i, '')
      .replace(/\*\*/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    // Base prompt — photorealism + character detail, NO layout (layout is per-panel)
    const basePrompt = `Photorealistic studio reference photograph, clean white seamless background, soft diffused even studio lighting, no shadows, every detail clearly visible, indistinguishable from professional studio photography, NOT illustration NOT cartoon NOT painting NOT digital art. Person: ${characterDetail}`

    console.log('Base prompt (first 200):', basePrompt.slice(0, 200))

    // ─── STEP 2: GENERATE ALL PANELS IN PARALLEL ──────────────────────────────
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
    const seed = Math.floor(Math.random() * 2147483647)

    console.log('Generating', PANELS.length, 'panels with seed', seed)

    const imageUrls = await Promise.all(
      PANELS.map(panel => runFlux(replicate, basePrompt, panel, seed))
    )

    console.log('All panels generated, compositing...')

    // ─── STEP 3: COMPOSITE INTO REFERENCE SHEET ───────────────────────────────
    // Row 0: 4 full-body panels (2:3 portrait) → target 400×600 each
    // Row 1: 3 face panels (1:1 square) → target 400×400 each
    const BODY_W = 400
    const BODY_H = 600
    const FACE_W = 533  // make face row same total width as body row: 4×400 = 1600 / 3 ≈ 533
    const FACE_H = 533
    const GAP = 8
    const PAD = 24
    const LABEL_H = 28

    const row0Panels = PANELS.filter(p => p.row === 0) // 4 body panels
    const row1Panels = PANELS.filter(p => p.row === 1) // 3 face panels

    const totalW = PAD * 2 + row0Panels.length * BODY_W + (row0Panels.length - 1) * GAP
    const totalH = PAD * 2 + BODY_H + LABEL_H + GAP + FACE_H + LABEL_H

    // Fetch all images in parallel
    const buffers = await Promise.all(imageUrls.map(url => fetchImageBuffer(url)))

    // Resize each panel to target dimensions
    const [bodyBuffers, faceBuffers] = await Promise.all([
      Promise.all(
        buffers.slice(0, 4).map(buf =>
          sharp(buf).resize(BODY_W, BODY_H, { fit: 'cover', position: 'top' }).webp({ quality: 90 }).toBuffer()
        )
      ),
      Promise.all(
        buffers.slice(4).map(buf =>
          sharp(buf).resize(FACE_W, FACE_H, { fit: 'cover', position: 'center' }).webp({ quality: 90 }).toBuffer()
        )
      ),
    ])

    // Build composite — start with white background
    const compositeOps = []

    // Row 0 — body panels
    bodyBuffers.forEach((buf, i) => {
      compositeOps.push({
        input: buf,
        top: PAD,
        left: PAD + i * (BODY_W + GAP),
      })
    })

    // Row 1 — face panels (centered under the 4 body panels)
    const row1TotalW = row1Panels.length * FACE_W + (row1Panels.length - 1) * GAP
    const row1Left = PAD + Math.floor((totalW - PAD * 2 - row1TotalW) / 2)
    faceBuffers.forEach((buf, i) => {
      compositeOps.push({
        input: buf,
        top: PAD + BODY_H + LABEL_H + GAP,
        left: row1Left + i * (FACE_W + GAP),
      })
    })

    const sheet = await sharp({
      create: {
        width: totalW,
        height: totalH,
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .composite(compositeOps)
      .webp({ quality: 92 })
      .toBuffer()

    const base64Sheet = sheet.toString('base64')
    const imageUrl = `data:image/webp;base64,${base64Sheet}`

    return Response.json(
      {
        imageUrl,
        engineeredPrompt: basePrompt,
        panelUrls: imageUrls.map((url, i) => ({ label: PANELS[i].label, url })),
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('Generate error:', err)
    return Response.json(
      { error: err.message || 'Generation failed' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
