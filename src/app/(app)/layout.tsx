import { AppShell } from "@/components/layout/AppShell";
import { displayNameFor, getSession } from "@/lib/authz";

// The session is read here only to choose the frame and greeting, not as an auth check:
// layouts don't re-render on navigation, so each page checks the session itself.
// Signed out, `/` renders the Login screen bare, without the nav.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) return children;

  return <AppShell displayName={displayNameFor(session.user)}>{children}</AppShell>;
}
