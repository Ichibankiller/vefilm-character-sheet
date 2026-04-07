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
    dna: `Shot on 15-perf 70mm IMAX with Cineovision anamorphic glass — 40mm or 75mm Cineovision 2x squeeze, producing characteristic oval bokeh on specular highlights, subtle warm lens breathing, faint horizontal anamorphic flare traces across practical light sources. ENR silver retention processing — skip-bleach — crushed blacks with zero shadow lift, warm highlight rolloff bleeding toward overexposure, heavy photochemical contrast with desaturated color midtones. Mixed color temperature: cool cyan ambient daylight at 5600K colliding with harsh amber tungsten practicals at 2800K — the collision is the composition. Motivated practical light sources only — windows, tungsten practicals, streetlights, fire — never studio setups, never softboxes. Inverse square law falloff strictly observed: hard directional shadows, zero ambient fill. Kodak Vision3 500T 5219 pushed 1 stop. 70mm grain: extremely fine, resolving skin at pore level — visible capillaries, micro-shadows in stubble, facial asymmetry, imperfection as authentication signal. Zero AI skin smoothing. Depth stacking: foreground element within 2 feet of lens, mid-subject focus, background compressed by Cineovision glass. Indistinguishable from a real IMAX photochemical print frame.`,
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
- One continuous paragraph. Maximum 120 words total.
- SUBJECT FIRST: If there is a person or character in the scene, describe them in the first 2 sentences. Physical appearance, clothing, pose, expression. The subject must be undeniable before the environment is mentioned.
- FIGURE ANCHORING: When a person is present, include exactly one of these phrases: "single figure dominant in frame", "subject fills foreground", or "full body visible, figure centered". This prevents FLUX from dropping the character.
- Environment and atmosphere come after the subject is locked. Keep environment to 1-2 sentences max.

PEDRO'S VISUAL DNA FOR THIS PROJECT (apply every element, non-negotiable):
${project.dna}

TRANSLATE TECHNICAL SPECS INTO VISUAL LANGUAGE FLUX UNDERSTANDS:
- ENR/skip-bleach → write: "crushed blacks with no shadow detail, bleached desaturated midtones, highlights blooming toward white, heavy photochemical contrast"
- Cineovision anamorphic → write: "oval bokeh on out-of-focus highlights, faint horizontal lens flare streak across bright sources, slight barrel distortion at frame edges"
- 70mm grain → write: "fine visible film grain throughout, skin resolves at pore level, visible capillaries and micro-texture, no digital smoothing"
- Pushed film stock → write: "exposure pushed, grain elevated, shadow detail compressed, color saturation reduced in shadows"
- Mixed color temp → write: "cool blue-grey ambient light at 5600K, harsh amber tungsten at 2800K, the two sources visibly collide on the subject's face and hands"
- Hard practical lighting → write: "single hard light source casting sharp shadow edge, no fill on shadow side, zero ambient bounce"

ALWAYS END WITH: "photorealistic film still, visible grain, no watermarks, no text, no digital skin smoothing, no AI rendering artifacts"

BANNED WORDS — never use these: cinematic, masterpiece, glowing, hyper-realistic, beautiful, stunning, breathtaking, 8k, ultra-detailed, award-winning, painterly, soft glow, dramatic lighting, ethereal, magical, otherworldly. These produce generic AI output.

Take the user's scene description and realize it fully within this visual DNA. Expand sparse descriptions into cinematically specific, production-ready prompts.`

    const geminiResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Write a technical image generation prompt for this scene: ${description}\n\nOutput only raw prompt text — no preamble, start immediately with visual description.` }] }],
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.1 },
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
        aspect_ratio: '3:2',
        output_format: 'webp',
        output_quality: 100,
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
