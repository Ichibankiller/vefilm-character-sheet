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

// 4 panels only — avoids Replicate rate limits while still covering key angles
const PANELS = [
  {
    label: 'FRONT',
    viewInstruction: 'Full body, facing directly toward camera, standing neutral, arms at sides, feet shoulder-width apart.',
    aspect_ratio: '2:3',
    col: 0,
  },
  {
    label: '3/4 VIEW',
    viewInstruction: 'Full body, three-quarter angle, body rotated 45 degrees to the right, face turned slightly toward camera.',
    aspect_ratio: '2:3',
    col: 1,
  },
  {
    label: 'PROFILE',
    viewInstruction: 'Full body, strict side profile, facing right, head and body in true 90-degree profile.',
    aspect_ratio: '2:3',
    col: 2,
  },
  {
    label: 'FACE DETAIL',
    viewInstruction: 'Head and shoulders close-up portrait, face directly forward, neutral expression, sharp focus on facial features.',
    aspect_ratio: '1:1',
    col: 3,
  },
]

async function runFlux(replicate, basePrompt, panel, seed, attempt = 0) {
  const panelPrompt = `${basePrompt} ${panel.viewInstruction} Single photograph, no collage, no multiple people, one person only.`

  try {
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
  } catch (err) {
    // Retry up to 2 times on 429 rate limit with exponential backoff
    if (attempt < 2 && (err.message?.includes('429') || err.message?.includes('throttled'))) {
      const delay = (attempt + 1) * 8000
      console.log(`Panel ${panel.label} rate limited — retrying in ${delay}ms (attempt ${attempt + 1})`)
      await new Promise(r => setTimeout(r, delay))
      return runFlux(replicate, basePrompt, panel, seed, attempt + 1)
    }
    throw err
  }
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

    // ─── STEP 2: GENERATE 4 PANELS IN PARALLEL ────────────────────────────────
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
    const seed = Math.floor(Math.random() * 2147483647)

    console.log('Generating 4 panels with seed', seed)

    // Stagger start times slightly to avoid burst rate limiting
    const imageUrls = await Promise.all(
      PANELS.map((panel, i) =>
        new Promise(resolve => setTimeout(resolve, i * 300))
          .then(() => runFlux(replicate, basePrompt, panel, seed))
      )
    )

    console.log('All panels generated, compositing...')

    // ─── STEP 3: COMPOSITE — 4 PANELS SIDE BY SIDE ────────────────────────────
    // First 3: full-body (2:3) → 380×570 each
    // Last 1: face detail (1:1) → 380×380, vertically centered
    const BODY_W = 380
    const BODY_H = 570
    const FACE_W = 380
    const FACE_H = 380
    const GAP = 6
    const PAD = 20

    const totalW = PAD * 2 + 4 * BODY_W + 3 * GAP
    const totalH = PAD * 2 + BODY_H

    // Fetch all 4 images
    const buffers = await Promise.all(imageUrls.map(url => fetchImageBuffer(url)))

    // Resize
    const resizedPanels = await Promise.all([
      sharp(buffers[0]).resize(BODY_W, BODY_H, { fit: 'cover', position: 'top' }).webp({ quality: 90 }).toBuffer(),
      sharp(buffers[1]).resize(BODY_W, BODY_H, { fit: 'cover', position: 'top' }).webp({ quality: 90 }).toBuffer(),
      sharp(buffers[2]).resize(BODY_W, BODY_H, { fit: 'cover', position: 'top' }).webp({ quality: 90 }).toBuffer(),
      sharp(buffers[3]).resize(FACE_W, FACE_H, { fit: 'cover', position: 'center' }).webp({ quality: 90 }).toBuffer(),
    ])

    const compositeOps = [
      { input: resizedPanels[0], top: PAD, left: PAD },
      { input: resizedPanels[1], top: PAD, left: PAD + BODY_W + GAP },
      { input: resizedPanels[2], top: PAD, left: PAD + (BODY_W + GAP) * 2 },
      // Face panel centered vertically in the body-height column
      { input: resizedPanels[3], top: PAD + Math.floor((BODY_H - FACE_H) / 2), left: PAD + (BODY_W + GAP) * 3 },
    ]

    const sheet = await sharp({
      create: {
        width: totalW,
        height: totalH,
        channels: 3,
        background: { r: 238, g: 238, b: 238 },
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
