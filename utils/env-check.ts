// Add missing environment variables check
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

if (typeof window !== 'undefined') {
    requiredEnvVars.forEach((key) => {
        if (!process.env[key]) {
            console.error(`Missing required environment variable: ${key}`);
        }
    });
}
