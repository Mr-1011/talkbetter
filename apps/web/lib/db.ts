// Server only. Supabase table `scenes` (id uuid, created_at timestamptz, scene jsonb). RLS is on with no policy: only this server key reads and writes.
export const db = (query: string, init?: RequestInit) =>
  fetch(`${process.env.SUPABASE_URL}/rest/v1/scenes${query}`, {
    ...init,
    headers: { apikey: process.env.SUPABASE_SECRET_KEY!, "Content-Type": "application/json", Prefer: "return=representation" },
  }).then((r) => r.json());
