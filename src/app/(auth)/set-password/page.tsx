import { AuthForm } from '@/components/auth/AuthForm';
import { requireUser } from '@/server/auth/server';
export const dynamic = 'force-dynamic';
export default async function SetPasswordPage() {
  await requireUser();
  return <AuthForm mode="password" />;
}
