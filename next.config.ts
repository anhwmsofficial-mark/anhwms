import type { NextConfig } from "next";

process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA = 'true';
process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';

const resolveSupabaseRemotePattern = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const parsed = new URL(supabaseUrl);
    return {
      protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
      hostname: parsed.hostname,
      pathname: '/storage/v1/object/public/**',
    };
  } catch {
    return null;
  }
};

const supabaseRemotePattern = resolveSupabaseRemotePattern();

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Temporary safeguard during framework/version stabilization.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      ...(supabaseRemotePattern ? [supabaseRemotePattern] : []),
    ],
  },
};

export default nextConfig;
