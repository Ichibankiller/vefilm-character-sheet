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
    dna: `Shot on 15-perf 70mm IMAX with Cineovision anamorphic glass — 40mm or 75mm Cineovision 2x squeeze, producing characteristic oval bokeh on specular highlights, subtle warm lens breathing, and faint horizontal anamorphic flare traces across practical light sources. Kodachrome 64 color science: warm amber-gold in shadow rolloff with rich saturation in midtones, slightly desaturated highlights preventing blowout. Motivated practical light sources only — windows, tungsten practicals, streetlights, fire — never studio setups, never softboxes. Inverse square law falloff strictly observed: hard directional shadows, zero ambient fill unless period-accurate. 70mm grain character: extremely fine, almost imperceptible at normal viewing, resolving skin at pore level — visible capillaries, micro-shadows in stubble, asymmetry of real faces. Depth stacking: foreground element within 2 feet of lens, mid subject, background compressed by Cineovision glass. Kodak Vision3 500T 5219 pushed 1 stop. 2.39:1 aspect ratio. Indistinguishable from a real IMAX photochemical print.`,
  },
  greyhouse: {
    name: 'THE GREY HOUSE — SCOTLAND 1967',
    dna: `Isolated Scottish Highlands psychological horror, 1967. Shot on Super Panavision 70 with Panavision C-series anamorphic lenses — 50mm C-series, 2x squeeze, characteristic 1960s lens softness in deep focus falloff, period-accurate chromatic fringing on high-contrast edges. Kodak 5222 Double-X pushed 1.5 stops — heavy structured grain, crushed shadow detail, compressed highlights bleeding to near-white. Exterior: overcast Scottish sky producing flat directionless diffused daylight with deep atmospheric moisture and low-lying mist. Interior: motivated tungsten practical sources at 2800K creating warm amber islands against cold stone-grey shadow, hard 8:1 contrast ratio minimum. Architecture: rough-cut granite, heavy timber beams, cold slate floors, iron fittings — every surface textured with age and moisture. Color palette: desaturated steel grey and slate blue punctuated by isolated tungsten amber. Psychological dread constructed through deep negative space and shadow geometry. 2.39:1.`,
  },
  knockknock: {
    name: 'KNOCK KNOCK — 90s BRONX',
    dna: `1990s South Bronx New York crime drama. Shot on Kodak Vision 500T 5279 35mm with Zeiss Master Prime spherical lenses — 35mm and 50mm focal lengths, clinically sharp with zero lens character romanticism. Available light only philosophy. Primary light: sodium vapor streetlights at 2200K saturating the environment in amber-orange-gold, opposing deep navy blue shadow zones with absolute zero fill. Wet pavement reflecting all light sources — doubled light painting on ground plane, halation on reflective surfaces. Urban texture at full resolution: rusted chain-link, graffiti-tagged brick with paint layer depth, corrugated metal shutters, condensation on steam pipes. Neon signage creating secondary color counterpoint — deep magenta and cyan cutting through sodium amber. High contrast, fully crushed blacks with zero shadow lift. No fill cards. The night is absolute black. Era-accurate: 1990-1995 vehicles, wardrobe, typography, street infrastructure. 1.85:1.`,
  },
  ichibonkiller: {
    name: 'ICHIBONKILLER — COLD NIHILISM',
    dna: `Philosophical detachment rendered as pure image. Shot on Kodak 5219 Vision3 pushed 2 full stops with ARRI/Zeiss Ultra Prime lenses — 32mm Ultra Prime at T1.9, clinical sharpness with zero warmth or lens character. Near-monochrome: cold desaturated greys and whites stripped of all colorimetric identity, single intentional accent color only when narratively load-bearing. Institutional single-source hard light — fluorescent overhead at 4100K, bare tungsten bulb at 2400K, or harsh north-facing window. Shadows fall hard with no fill, no bounce, no mercy. Pushed grain is aggressive and structural — obscuring fine detail, softening faces toward abstraction, making skin clinical and impersonal. Negative space carries narrative weight equivalent to subject. Surfaces: raw concrete, plate glass, brushed steel, institutional paint — nothing organic, nothing warm. Subjects composed as specimens under observation. Long focal length compression flattening spatial relationships. 1.85:1. Stillness is not empty — it is loaded.`,
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
- Exact film format (70mm IMAX, 35mm, Super 35, etc.) and aspect ratio
- Exact lens name and focal length (e.g. "Cineovision 75mm 2x anamorphic", "Zeiss Ultra Prime 32mm T1.9")
- Color temperature of every light source in Kelvin
- Shadow contrast ratio (e.g. "8:1 contrast ratio, zero fill")
- Film stock name and push/pull (e.g. "Kodak Vision3 500T 5219, pushed 1 stop")
- Grain character specific to that stock and push
- Any era-specific or format-specific optical artifacts (anamorphic flare, lens breathing, chromatic fringing)
- "photorealistic cinematic film still, no watermarks, no text, no AI smoothing"

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
