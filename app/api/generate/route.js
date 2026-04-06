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

    const systemPrompt = `You are a technical prompt writer for professional film production. Your ONLY job is to output raw prompt text — nothing else.

ABSOLUTE OUTPUT RULES — NO EXCEPTIONS:
- Output ONLY the prompt text. Zero preamble. Zero explanation. Zero markdown formatting.
- No "Here is", no "**Prompt:**", no asterisks, no bullet points, no headers, no line breaks between sentences.
- Begin your output immediately with the character description. First word must be a descriptive word about the character.
- One continuous paragraph only.

YOUR TASK: Describe the physical character in precise detail for a production reference sheet. Focus entirely on the PERSON — their exact physical appearance, face, build, skin, hair, eyes, wardrobe details, fabric textures, shoes, accessories, distinguishing marks. Write as if briefing a casting director, costume designer, and makeup artist simultaneously.

CRITICAL — WHAT TO DESCRIBE:
- Age (specific range, e.g. "late 30s"), ethnicity, skin tone (specific, e.g. "pale with warm undertones", "medium brown", "deep brown")
- Face shape, jaw, cheekbones, forehead, nose shape, lip shape
- Eye color and shape (e.g. "deep-set hazel eyes, heavy upper lids")
- Hair: exact color, texture, length, styling (e.g. "short dark brown hair, fine texture, pushed forward, slight cowlick at crown")
- Any facial hair: exact coverage, color, density
- Distinguishing features: scars, moles, freckles, glasses (frame style, color), piercings
- Build: height impression, weight, posture, muscle tone
- Wardrobe: every garment with fabric, color, fit, wear/age of clothing
- Footwear: style, color, condition
- Overall emotional baseline: how this person carries themselves

DO NOT mention the sheet format, panels, background, or lighting. That is handled separately. Just describe the character.`

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
        ? `Analyze this reference image and extract every precise physical detail about this person. Output only the character description — no preamble, no markdown, start immediately with descriptive text about the person.`
        : `Write a precise physical description of this character: ${characterDescription}. Output only the character description — no preamble, no markdown, start immediately with descriptive text about the person.`,
    })

    const geminiResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: geminiContent }],
      systemInstruction: systemPrompt,
    })

    // Strip any markdown/preamble Gemini might still output
    let characterDetail = geminiResponse.candidates[0].content.parts[0].text.trim()
    characterDetail = characterDetail
      .replace(/^\*\*[^*]+\*\*\s*/i, '')
      .replace(/^Here'?s?\s+[^:]+:\s*/i, '')
      .replace(/^Prompt:\s*/i, '')
      .replace(/\*\*/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    // Build the final prompt — locked sheet format prefix + Gemini's character detail
    // Sheet format: clean white studio reference photography (so all details read clearly)
    // Character appearance: photorealistic, film-quality skin and texture
    const finalPrompt = `Professional film production character reference sheet. Six photorealistic photographs of the exact same person arranged in a grid: top row shows three-quarter body shots — FRONT facing camera, THREE-QUARTER angle facing right, SIDE PROFILE facing right, BACK view; bottom row shows three close-up face portraits — FACE FRONT, FACE THREE-QUARTER, FACE PROFILE. Clean white seamless studio background. Soft even diffused studio lighting with no harsh shadows — every wardrobe and facial detail fully visible. Photorealistic, indistinguishable from actual studio photography. NOT illustration, NOT cartoon, NOT painting, NOT digital art. Real photograph quality. The person in every panel is identical — same face, same clothes, same hair, same build. Character: ${characterDetail}`

    console.log('Final prompt (first 300):', finalPrompt.slice(0, 300))

    // ─── STEP 2: REPLICATE — FLUX 1.1 PRO ─────────────────────────────────────
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

    const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
      input: {
        prompt: finalPrompt,
        aspect_ratio: '16:9',
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
