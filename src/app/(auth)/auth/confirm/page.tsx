import { AuthForm } from '@/components/auth/AuthForm';
export const dynamic = 'force-dynamic';
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash, type } = await searchParams;
  // GET never consumes a one-time token: email scanners cannot accept an invitation.
  return <AuthForm mode="confirm" tokenHash={token_hash} tokenType={type} />;
}
