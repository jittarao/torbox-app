import ApiKeyGate from '@/components/shared/ApiKeyGate';

/**
 * (app) layout always passes the page segment through ApiKeyGate.
 * The gate keeps `{children}` mounted for Instant Navigation validation and
 * only wraps with AppShell when a session API key is present.
 */
export default function AppLayout({ children }) {
  return <ApiKeyGate>{children}</ApiKeyGate>;
}
