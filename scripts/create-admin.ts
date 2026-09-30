import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const args = process.argv.slice(2);
  let email = 'demo@qaleb.site';
  let password = 'demo123456';

  for (const arg of args) {
    if (arg.startsWith('--email=')) {
      email = arg.split('=')[1];
    } else if (arg.startsWith('--password=')) {
      password = arg.split('=')[1];
    }
  }

  if (!password) {
    console.error('❌ Error: Password is required. Usage: npx tsx --env-file=.env.local scripts/create-admin.ts --email=demo@qaleb.site --password=demo123456');
    process.exit(1);
  }

  console.log(`🔐 Provisioning admin account for: ${email}...`);

  const adminClient = createAdminClient();

  // Check if user already exists
  const { data: userList, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Failed to list users:', listError.message);
    process.exit(1);
  }

  const existingUser = userList.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    console.log(`ℹ️ User found (ID: ${existingUser.id}). Updating password and confirming email...`);
    const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(
      existingUser.id,
      {
        password: password,
        email_confirm: true,
        user_metadata: {
          ...existingUser.user_metadata,
          role: 'admin',
        },
      }
    );

    if (updateError) {
      console.error('❌ Failed to update user:', updateError.message);
      process.exit(1);
    }

    console.log(`✅ Success! Admin account updated: ${updated.user?.email}`);
  } else {
    console.log(`ℹ️ Creating new user account...`);
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
      },
    });

    if (createError) {
      console.error('❌ Failed to create user:', createError.message);
      process.exit(1);
    }

    console.log(`✅ Success! New admin account created: ${created.user?.email}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
