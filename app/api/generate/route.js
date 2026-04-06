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

    const systemPrompt = `You are a technical prompt writer for professional film production image generation. Your ONLY job is to output raw prompt text — nothing else.

RULES — ABSOLUTE, NO EXCEPTIONS:
- Output ONLY the prompt text. Zero preamble. Zero explanation. Zero markdown. No "Here is", no "**Prompt:**", no asterisks, no headers.
- Start your output directly with a visual description word. Example: "Film production character reference sheet..."
- If you include ANY meta-text, preamble, or markdown formatting, the output is broken and unusable.

YOUR TASK: Write a prompt describing a horizontal film production character reference sheet. The sheet is a single wide image containing FOUR panels arranged left to right: FRONT VIEW | THREE-QUARTER VIEW | PROFILE VIEW | CLOSE-UP DETAIL. Each panel is labeled with small text at the bottom. The sheet background is off-white/light grey like a professional production document.

PHOTOGRAPHY/FILM STYLE — NON-NEGOTIABLE (Pedro Feria Pino's production DNA):
- Photographic hyper-realism. Indistinguishable from actual 35mm film photography. NOT illustration. NOT digital art. NOT painting. NOT cartoon. REAL photography only.
- Kodachrome 64 color science: warm shadow tones, slightly desaturated highlights, rich saturated midtones
- Practical motivated lighting with hard directional falloff following inverse square law — real shadows, not diffused
- Visible skin texture: pores, micro-shadows, stubble detail, realistic imperfection — absolutely zero AI skin smoothing
- Fine film grain throughout: Kodak 5219 pushed 1 stop character
- Anamorphic lens quality: slight horizontal bokeh ellipsis on out-of-focus elements

Write the character details using the input provided. Be specific about: exact facial features, skin tone, age markers, hair texture and color, eye color and shape, any distinguishing marks, wardrobe fabrics and wear, physical build.`

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
      text: imageBase64
        ? `Extract every precise visual detail from this reference image and write the character sheet prompt. Output only the raw prompt text — no preamble, no markdown, start directly with the visual description.`
        : `Write the character sheet prompt for this character: ${characterDescription}. Output only the raw prompt text — no preamble, no markdown, start directly with the visual description.`,
    })

    const geminiResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: geminiContent }],
      systemInstruction: systemPrompt,
    })

    // Strip any markdown/preamble Gemini might still sneak in
    let engineeredPrompt = geminiResponse.candidates[0].content.parts[0].text.trim()
    engineeredPrompt = engineeredPrompt
      .replace(/^\*\*Prompt:\*\*\s*/i, '')
      .replace(/^Here'?s?\s+[^:]+:\s*/i, '')
      .replace(/^Prompt:\s*/i, '')
      .replace(/\*\*/g, '')
      .trim()

    // Hard-anchor photorealism — prepend locked style prefix so FLUX can't drift toward illustration
    const STYLE_ANCHOR = 'Professional film production character reference sheet, four-panel layout arranged horizontally (FRONT VIEW, THREE-QUARTER VIEW, PROFILE VIEW, CLOSE-UP DETAIL), photorealistic 35mm film photography, NOT illustration, NOT cartoon, NOT digital painting, real human photograph, '
    const finalPrompt = STYLE_ANCHOR + engineeredPrompt

    console.log('Final prompt (first 300):', finalPrompt.slice(0, 300))

    // ─── STEP 2: REPLICATE — FLUX 1.1 PRO ─────────────────────────────────────
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

    const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
      input: {
        prompt: finalPrompt,
        aspect_ratio: '4:3',
        output_format: 'webp',
        output_quality: 95,
        safety_tolerance: 2,
        prompt_upsampling: true,
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

    return Response.json({ imageUrl, engineeredPrompt: finalPrompt }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('Generate error:', err)
    return Response.json(
      { error: err.message || 'Generation failed' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
