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

// Pedro's full project DNA
const PROJECT_DNA = {
  cinematic: {
    name: 'PEDRO FERIA PINO — SIGNATURE',
    dna: `Kodachrome 64 color science: warm amber-gold shadows with rich saturation, slightly desaturated highlights preventing blowout, deep saturated midtones. Motivated practical light sources only — no studio setups, no softboxes, only real-world sources (windows, practicals, streetlights, fire). Inverse square law falloff strictly observed — hard edge shadows, directional light with no ambient fill unless period-accurate. Anamorphic 2.39:1 squeeze with characteristic horizontal bokeh ellipsis on specular highlights. Kodak 5219 Vision3 pushed 1 stop for fine grain presence. Skin texture at full resolution — visible pores, micro-shadows under stubble, asymmetry, capillaries, imperfection as authenticity. Zero AI skin smoothing. Depth stacking: foreground element within 2 feet of lens, mid subject, compressed background. This is photographic realism at 35mm — indistinguishable from real photography.`,
  },
  greyhouse: {
    name: 'THE GREY HOUSE — SCOTLAND 1967',
    dna: `Isolated Scottish Highlands horror atmosphere, 1967. Overcast diffused daylight creating flat directionless exterior light with deep atmospheric moisture. Interior scenes: motivated tungsten practical sources at 2800K creating warm amber islands against cold stone-grey shadows, high contrast ratio 8:1 minimum. Kodak 5222 Double-X pushed for heavy grain and compressed tonal range. Period-accurate architecture: rough-cut stone, heavy timber beams, cold slate floors. Anamorphic 2.39:1 with notable depth falloff. Color palette: desaturated steel grey/slate blue environment punctuated by warm tungsten amber. Psychological dread through negative space and motivated shadow. Mist and atmospheric haze in all exterior shots. Textures of age and decay in all surfaces.`,
  },
  knockknock: {
    name: 'KNOCK KNOCK — 90s BRONX',
    dna: `1990s South Bronx New York crime drama. Primary light: sodium vapor streetlights at 2200K saturating the entire environment in amber-orange-gold, opposing deep navy blue shadow areas with absolute zero fill. Wet pavement reflecting light sources creating doubled light painting on ground plane. Urban texture: chain-link fences with rust, graffiti-tagged brick walls, corrugated metal shutters, steam pipe condensation. Neon signage providing secondary color contrast in deep magenta and cyan. Kodak Vision3 500T 35mm, Master Prime lenses, available light philosophy. Era-accurate wardrobe, vehicles, signage. High contrast, crushed blacks, no lift in shadows. The night is black.`,
  },
  ichibonkiller: {
    name: 'ICHIBONKILLER — COLD NIHILISM',
    dna: `Philosophical detachment rendered visually. Near-monochrome palette — cold desaturated greys and whites with single accent color only when symbolically intentional. Institutional single-source hard light creating harsh geometry of shadow — fluorescent overhead, bare bulb, or harsh window. No warmth. No comfort. Negative space as narrative weight. Urban concrete, glass, steel — surfaces stripped of humanity. Kodak 5219 pushed 2 stops creating aggressive grain obscuring detail and softening faces toward abstraction. Slow zoom compositions implying surveillance and inevitability. Subjects filmed as specimens, not subjects. Stillness.`,
  },
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { description, style } = body

    if (!description) {
      return Response.json({ error: 'Description required' }, { status: 400 })
    }

    const project = PROJECT_DNA[style] || PROJECT_DNA.cinematic

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const systemPrompt = `You are Pedro Feria Pino's personal cinematographer AI. Pedro is a filmmaker and AI systems director with credits on Netflix, Disney, TLC, and MTV. You write image generation prompts that apply his precise visual DNA to any scene description.

OUTPUT RULES — ABSOLUTE:
- Output ONLY the image generation prompt. No preamble. No explanation. No markdown. Start immediately with a visual word.
- One continuous paragraph.

PEDRO'S VISUAL DNA FOR THIS PROJECT (apply every element, non-negotiable):
${project.dna}

ALWAYS SPECIFY IN OUTPUT:
- Exact film stock
- Exact lens and focal length
- Color temperature of each light source in Kelvin
- Shadow contrast ratio (e.g. "8:1 contrast ratio")
- Grain character
- Any era-specific details
- "photorealistic cinematic film still, no watermarks, no text"

Take the user's scene description and realize it fully within this visual DNA. Expand sparse descriptions into cinematically specific, production-ready prompts.`

    const geminiResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Write a cinematic image generation prompt for this scene: ${description}\n\nOutput only raw prompt text — no preamble, start immediately with visual description.` }] }],
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
    console.error('Signature generate error:', err)
    return Response.json({ error: err.message || 'Generation failed' }, { status: 500, headers: CORS_HEADERS })
  }
}
