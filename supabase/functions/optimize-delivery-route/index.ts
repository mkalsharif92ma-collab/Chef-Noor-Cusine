import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const body = await req.json()
    const stops = Array.isArray(body.stops) ? body.stops.filter((s:any) => s.latitude != null && s.longitude != null) : []
    if (!stops.length) return new Response(JSON.stringify({ error: "No GPS stops" }), { status: 400, headers: { ...cors, "Content-Type":"application/json" } })
    const key = Deno.env.get("GOOGLE_MAPS_API_KEY")
    if (!key) return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY is not configured" }), { status: 503, headers: { ...cors, "Content-Type":"application/json" } })

    const origin = body.origin && body.origin.latitude != null ? body.origin : stops[0]
    let current = origin
    let pool = [...stops]
    const ordered:any[] = []

    // Google Routes API is used as the travel-time engine. We ask Google for
    // one-to-many driving durations at every step, then choose the fastest next stop.
    while (pool.length) {
      const matrixBody = pool.map((s:any) => ({ origin: { location: { latLng: { latitude:Number(current.latitude), longitude:Number(current.longitude) } } }, destination: { location: { latLng: { latitude:Number(s.latitude), longitude:Number(s.longitude) } } }, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }))
      const resp = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
        method:"POST", headers:{ "Content-Type":"application/json", "X-Goog-Api-Key":key, "X-Goog-FieldMask":"originIndex,destinationIndex,duration,distanceMeters,status" }, body:JSON.stringify(matrixBody)
      })
      if (!resp.ok) throw new Error(`Google Routes API ${resp.status}`)
      const rows = await resp.json()
      let best = 0, bestSeconds = Number.POSITIVE_INFINITY
      rows.forEach((r:any) => { const i=Number(r.destinationIndex); const sec=parseFloat(String(r.duration||"0s").replace("s","")); if (Number.isFinite(sec) && sec<bestSeconds) { best=i; bestSeconds=sec } })
      const picked = pool.splice(best,1)[0]
      ordered.push({ ...picked, eta_minutes: Number.isFinite(bestSeconds) ? Math.max(1,Math.ceil(bestSeconds/60)) : null })
      current = picked
    }
    return new Response(JSON.stringify({ stops: ordered, provider:"google_routes" }), { headers:{...cors,"Content-Type":"application/json"} })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status:500, headers:{...cors,"Content-Type":"application/json"} })
  }
})
