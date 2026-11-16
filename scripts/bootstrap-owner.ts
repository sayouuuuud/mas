import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// No credentials are accepted as command arguments or printed in the output.
const input = z
  .object({
    SUPABASE_URL: z.url().startsWith('https://'),
    SUPABASE_SECRET_KEY: z.string().min(20),
    OWNER_USER_ID: z.uuid(),
    OWNER_DISPLAY_NAME: z.string().trim().min(2).max(120),
  })
  .safeParse({
    ...process.env,
    SUPABASE_URL:
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY:
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
if (!input.success) {
  process.stderr.write(
    'Configure the Supabase URL, server secret, existing Auth user ID and owner display name securely.\n',
  )
  process.exit(1)
}
const config = input.data
const client = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
async function main() {
  const { error } = await client.rpc('mas_bootstrap_owner', {
    p_user_id: config.OWNER_USER_ID,
    p_display_name: config.OWNER_DISPLAY_NAME,
  })
  if (error) {
    process.stderr.write(
      'Owner initialization failed; verify the user exists and no owner has already been initialized.\n',
    )
    process.exitCode = 1
    return
  }
  process.stdout.write(
    'Owner initialized. Sign in and enroll MFA before accessing administration.\n',
  )
}
main().catch(() => {
  process.stderr.write('Owner initialization could not reach Supabase.\n')
  process.exitCode = 1
})
