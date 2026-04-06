import { GoogleGenAI } from '@google/genai'
import Replicate from 'replicate'

export const maxDuration = 120

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { description, style, imageBase64, imageMimeType } = body

    if (!description && !imageBase64) {
      return Response.json({ error: 'Description or image required' }, { status: 400 })
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const STYLE_DNA = {
      greyhouse: 'Scotland 1967, isolated rural horror, overcast diffused daylight or tungsten practical interior sources, desaturated cold palette with warm tungsten accents, aging stone architecture, mist and atmospheric depth, Kodak 5222 Double-X grain, anamorphic 2.39:1, clinical dread',
      knockknock: '1990s South Bronx New York, amber sodium vapor streetlight at 2200K saturating everything orange-gold, opposing deep navy blue shadows with zero fill, wet pavement reflections of neon signs, chain-link fences, graffiti-covered brick, Kodak Vision3 500T, 35mm Master Prime, high contrast motivated practical sources only',
      ichibonkiller: 'cold nihilistic detachment, desaturated near-monochrome palette, institutional fluorescent or harsh single-source practical light, clinical emptiness, deep negative space, Kodak 5219 pushed 2 stops, urban concrete environments stripped of warmth',
      cinematic: 'Pedro Feria Pino signature DNA — Kodachrome 64 color science, warm shadows, inverse square law falloff, motivated practical sources, anamorphic lens character, visible film grain Kodak 5219, imperfection as authenticity, hyper-realism indistinguishable from 35mm photography',
    }

    const styleDNA = STYLE_DNA[style] || STYLE_DNA.cinematic

    const systemPrompt = `You are Pedro Feria Pino's personal cinematographer AI. You convert sketches, storyboard frames, and location references into ultra-precise FLUX image generation prompts.

OUTPUT RULES — ABSOLUTE:
- Output ONLY the prompt text. No preamble. No markdown. No explanation. Start immediately with a visual word.
- One continuous block of text.

TASK: Read the sketch/description/image provided and write a detailed image generation prompt that realizes it as a finished cinematic frame.

STYLE DNA TO APPLY (non-negotiable): ${styleDNA}

ALWAYS INCLUDE:
- Specific lens and focal length (e.g. "35mm Master Prime, anamorphic 2.39:1")
- Specific film stock (e.g. "Kodak Vision3 500T")
- Color temperature of every light source in Kelvin
- Shadow density and fill ratio
- Atmospheric elements: haze, dust, moisture
- Foreground/background depth relationship
- Era-accurate details if period piece
- "photorealistic cinematic film still, no watermarks, no text overlays"`

    let geminiContent = []
    if (imageBase64) {
      geminiContent.push({ inlineData: { data: imageBase64, mimeType: imageMimeType || 'image/jpeg' } })
    }
    geminiContent.push({
      text: imageBase64
        ? `Analyze this sketch/storyboard/reference image and write a cinematic image generation prompt realizing this as a finished film frame. Apply the style DNA. Output only raw prompt text — no preamble.`
        : `Write a cinematic image generation prompt for: ${description}. Apply the style DNA. Output only raw prompt text — no preamble.`,
    })

    const geminiResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: geminiContent }],
      systemInstruction: systemPrompt,
    })

    let engineeredPrompt = geminiResponse.candidates[0].content.parts[0].text.trim()
    engineeredPrompt = engineeredPrompt
      .replace(/^\*\*[^*]+\*\*\s*/i, '')
      .replace(/^Here'?s?\s+[^:]+:\s*/i, '')
      .replace(/^Prompt:\s*/i, '')
      .replace(/\*\*/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

    const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
      input: {
        prompt: engineeredPrompt,
        aspect_ratio: '16:9',
        output_format: 'webp',
        output_quality: 95,
        safety_tolerance: 2,
        prompt_upsampling: true,
      },
    })

    const raw = Array.isArray(output) ? output[0] : output
    const imageUrl = typeof raw === 'string' ? raw : (raw?.url?.() ?? String(raw))

    return Response.json({ imageUrl, engineeredPrompt }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('Sketch generate error:', err)
    return Response.json({ error: err.message || 'Generation failed' }, { status: 500, headers: CORS_HEADERS })
  }
}
