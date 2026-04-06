import { GoogleGenAI } from '@google/genai'
import Replicate from 'replicate'

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
    const { characterDescription, imageBase64, imageMimeType } = body

    if (!characterDescription && !imageBase64) {
      return Response.json({ error: 'Character description or image is required' }, { status: 400 })
    }

    // ─── STEP 1: GEMINI 2.5 FLASH — PROMPT ENGINEER ───────────────────────────
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const systemPrompt = `You are a specialist in writing ultra-precise image generation prompts for character consistency sheets used in professional film production. Your outputs are used by Pedro Feria Pino, a filmmaker and AI systems director with credits on Netflix, Disney, TLC, and MTV.

Your prompt must describe a SINGLE IMAGE that functions as a multi-view character reference sheet — like a film production bible page. The image should contain:
- Front-facing portrait (clean, centered)
- 3/4 view
- Profile/side view
- Close-up of face and key features

CRITICAL STYLE REQUIREMENTS (Pedro's DNA — non-negotiable):
- Photographic hyper-realism — indistinguishable from 35mm film photography
- Kodachrome 64 color science — warm shadows, slightly desaturated highlights, rich midtones
- Motivated practical lighting only — no studio flat light, no artificial rim lights unless period-accurate
- Inverse square law falloff — hard light drop-off, real shadows with directionality
- Skin texture: visible pores, micro-shadows, realistic imperfection (no AI skin smoothing)
- Anamorphic lens character — slight horizontal bokeh, subtle lens breathing
- Film grain: fine, not chunky — like Kodak 5219 pushed 1 stop
- Background: deep neutral (dark slate, aged concrete, or period-appropriate)
- Layout: clean white reference sheet with character views arranged professionally, character name/code label at top

CHARACTER SHEET FORMAT SPECIFICS:
- Label the sheet with "CHARACTER REFERENCE — [CHARACTER NAME OR CODE]"
- Each view angle labeled: FRONT / 3QTR / PROFILE / DETAIL
- Clean production design — like a prop from a real film's art department

OUTPUT: Write ONLY the image generation prompt. No explanation. No preamble. No markdown. Just the raw prompt text, starting with the visual description.`

    let geminiContent = []

    if (imageBase64) {
      geminiContent.push({
        inlineData: {
          data: imageBase64,
          mimeType: imageMimeType || 'image/jpeg',
        },
      })
    }

    geminiContent.push({
      text: `Write a multi-view character sheet image generation prompt for this character: ${characterDescription || 'Use the uploaded reference image to extract all visual details — face, build, wardrobe, hair, skin tone, age, distinguishing features.'}`,
    })

    const geminiResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: geminiContent }],
      systemInstruction: systemPrompt,
    })

    const engineeredPrompt = geminiResponse.candidates[0].content.parts[0].text.trim()

    console.log('Gemini engineered prompt:', engineeredPrompt.slice(0, 200) + '...')

    // ─── STEP 2: REPLICATE — FLUX 1.1 PRO ─────────────────────────────────────
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

    const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
      input: {
        prompt: engineeredPrompt,
        aspect_ratio: '3:4',
        output_format: 'webp',
        output_quality: 95,
        safety_tolerance: 2,
        prompt_upsampling: false,
      },
    })

    // Replicate SDK v1.x returns FileOutput objects — extract URL string
    let imageUrl
    if (Array.isArray(output)) {
      const first = output[0]
      imageUrl = typeof first === 'string' ? first : (first?.url?.() ?? String(first))
    } else {
      imageUrl = typeof output === 'string' ? output : (output?.url?.() ?? String(output))
    }

    return Response.json({ imageUrl, engineeredPrompt }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('Generate error:', err)
    return Response.json(
      { error: err.message || 'Generation failed' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
