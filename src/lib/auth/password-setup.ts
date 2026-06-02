import type { User } from '@supabase/supabase-js';

export function hasPasswordBeenSet(
  user: Pick<User, 'user_metadata'> | null | undefined
): boolean {
  return user?.user_metadata?.password_set === true;
}

/** Whether the user must complete initial password setup (invite / first access). */
export function userNeedsPasswordSetup(
  user: Pick<User, 'user_metadata' | 'created_at' | 'last_sign_in_at'> | null | undefined
): boolean {
  if (!user) return false;
  if (hasPasswordBeenSet(user)) return false;

  const meta = user.user_metadata ?? {};
  if (meta.invited === true) return true;

  if (
    user.created_at &&
    user.last_sign_in_at &&
    user.created_at === user.last_sign_in_at
  ) {
    return true;
  }

  return false;
}
