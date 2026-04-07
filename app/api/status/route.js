import Replicate from 'replicate'

export const maxDuration = 30

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',').filter(Boolean)
    const seedsParam = searchParams.get('seeds')
    const seeds = seedsParam ? seedsParam.split(',').map(Number) : []

    if (!ids?.length) {
      return Response.json(
        { error: 'ids parameter required' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

    // Poll all predictions in parallel
    const predictions = await Promise.all(ids.map(id => replicate.predictions.get(id)))

    const statuses = predictions.map(p => p.status)
    const allSucceeded = statuses.every(s => s === 'succeeded')
    const anyFailed = statuses.some(s => s === 'failed' || s === 'canceled')

    if (anyFailed) {
      const failed = predictions.find(p => p.status === 'failed' || p.status === 'canceled')
      console.error('Prediction failed:', failed?.error)
      return Response.json(
        {
          completed: true,
          failed: true,
          error: failed?.error || 'One or more predictions failed',
        },
        { headers: CORS_HEADERS }
      )
    }

    if (!allSucceeded) {
      // Still processing — let the client keep polling
      return Response.json(
        { completed: false, statuses },
        { headers: CORS_HEADERS }
      )
    }

    // All succeeded — extract image URLs
    const images = predictions.map((p, i) => {
      const raw = Array.isArray(p.output) ? p.output[0] : p.output
      const url = typeof raw === 'string' ? raw : (raw?.url?.() ?? String(raw))
      return {
        url,
        seed: seeds[i] ?? null,
        takeNum: i + 1,
      }
    })

    return Response.json(
      { completed: true, images },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('Status check error:', err)
    return Response.json(
      { error: err.message || 'Status check failed' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
