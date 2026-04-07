import { GoogleGenAI } from '@google/genai'
import Replicate from 'replicate'

// Only need time for Gemini + 3 non-blocking prediction creates
export const maxDuration = 60

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const PEDRO_DNA = `Kodachrome 64 color science: warm amber-gold shadows with rich saturation, slightly desaturated highlights preventing blowout, deep saturated midtones. Motivated practical light sources only — no studio setups, no softboxes, only real-world sources (windows, practicals, streetlights, fire). Inverse square law falloff strictly observed — hard edge shadows, directional light with no ambient fill unless period-accurate. Anamorphic 2.39:1 squeeze with characteristic horizontal bokeh ellipsis on specular highlights. Kodak 5219 Vision3 pushed 1 stop for fine grain presence. Skin texture at full resolution — visible pores, micro-shadows under stubble, asymmetry, capillaries, imperfection as authenticity. Zero AI skin smoothing. Depth stacking: foreground element within 2 feet of lens, mid subject, compressed background. Photographic realism at 35mm — indistinguishable from real photography.`

export async function POST(request) {
  try {
    const body = await request.json()
    const { description, lockedSeed } = body

    if (!description) {
      return Response.json(
        { error: 'Scene description required' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // ── STEP 1: GEMINI — BUILD CINEMATOGRAPHY PLAN + FLUX PROMPT ──────────────
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const systemPrompt = `You are Pedro Feria Pino's personal cinematographer AI. Pedro is a filmmaker and AI systems director with credits on Netflix, Disney, TLC, and MTV. You read a scene description and do two things: build a precise cinematography plan, then write the FLUX image generation prompt that realizes it.

PEDRO'S VISUAL DNA (apply every element — non-negotiable):
${PEDRO_DNA}

OUTPUT: Return valid JSON only. No markdown fences. No explanation. No preamble. Start your response with { and end with }.

JSON STRUCTURE (exact keys required):
{
  "cinematographyPlan": {
    "focalLength": "specific focal length and lens character (e.g. 35mm Cooke S4/i, shallow focus, creamy out-of-focus rendering)",
    "filmStock": "exact film stock and push/pull (e.g. Kodak Vision3 500T 5219, pushed 1 stop)",
    "colorTemp": "Kelvin value of each light source present (e.g. 2800K tungsten practical at frame left, 5600K through window right)",
    "contrastRatio": "lighting contrast ratio (e.g. 8:1)",
    "grain": "grain character and density (e.g. fine visible grain, pushed — adds texture without obscuring detail)",
    "mood": "one evocative phrase — the single emotional key to the image",
    "lightingPlan": "2-3 sentences describing the exact light sources, their direction, falloff, and what they do to the subject and environment",
    "composition": "1-2 sentences on framing, depth layers, negative space, where the eye lands"
  },
  "fluxPrompt": "One long continuous paragraph — the complete FLUX image generation prompt realizing this scene through Pedro's visual DNA. Include: exact film stock, focal length, Kelvin values of each source, contrast ratio, grain character, era-specific details if relevant, depth layering, skin texture instruction. End with: photorealistic cinematic film still, no watermarks, no text."
}`

    const geminiResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `Scene: ${description}\n\nOutput only the JSON object — start with { and end with }.` }],
        },
      ],
      systemInstruction: systemPrompt,
    })

    let rawText = geminiResponse.candidates[0].content.parts[0].text.trim()

    // Strip any code fences Gemini might add despite instructions
    rawText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    // Find the outermost JSON object
    const jsonStart = rawText.indexOf('{')
    const jsonEnd = rawText.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      rawText = rawText.slice(jsonStart, jsonEnd + 1)
    }

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch (parseErr) {
      console.error('Gemini JSON parse failed:', parseErr.message)
      console.error('Raw Gemini output:', rawText.slice(0, 500))
      throw new Error('Gemini returned malformed JSON — try again')
    }

    const { cinematographyPlan, fluxPrompt } = parsed

    if (!cinematographyPlan || !fluxPrompt) {
      throw new Error('Gemini response missing required fields')
    }

    // ── STEP 2: GENERATE 3 SEEDS ───────────────────────────────────────────────
    // If lockedSeed provided: Take 1 = exact locked frame, Takes 2+3 = nearby explorations
    // If no lock: 3 independent random seeds
    const seeds = lockedSeed != null
      ? [lockedSeed, lockedSeed + 7, lockedSeed + 13]
      : Array.from({ length: 3 }, () => Math.floor(Math.random() * 2147483647))

    // ── STEP 3: CREATE 3 ASYNC PREDICTIONS — RETURNS IMMEDIATELY ──────────────
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

    const predictions = await Promise.all(
      seeds.map(seed =>
        replicate.predictions.create({
          model: 'black-forest-labs/flux-1.1-pro',
          input: {
            prompt: fluxPrompt,
            aspect_ratio: '16:9',
            output_format: 'webp',
            output_quality: 95,
            safety_tolerance: 2,
            prompt_upsampling: true,
            seed,
          },
        })
      )
    )

    console.log('3 predictions created:', predictions.map(p => p.id))

    return Response.json(
      {
        success: true,
        predictionIds: predictions.map(p => p.id),
        cinematographyPlan,
        fluxPrompt,
        seeds,
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('Director generate error:', err)
    return Response.json(
      { error: err.message || 'Generation failed' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
