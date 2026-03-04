export function isSupabaseConfigured(): boolean {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey) return false;

  // Accept both default Supabase domains and custom domains.
  try {
    const parsed = new URL(supabaseUrl);
    const hasHttpProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    const hasHost = Boolean(parsed.host);
    // JWT-like anon key is typically long, but keep threshold loose for compatibility.
    const hasReasonableKey = supabaseKey.length >= 20;
    return hasHttpProtocol && hasHost && hasReasonableKey;
  } catch {
    return false;
  }
}
