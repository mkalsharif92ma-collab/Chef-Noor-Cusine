import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://sihouvcqjcjkhyjorthy.supabase.co"

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

console.log("SUPABASE URL:", supabaseUrl)
console.log("KEY EXISTS:", Boolean(supabasePublishableKey))

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)