import { EmailConfirmBanner } from '@/components/email-confirm-banner';
import { Header } from '@/components/header';

// Route protection happens server-side in src/middleware.ts: requests without
// a live session cookie never reach these pages.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container flex-1 space-y-6 py-6 sm:py-8">
        <EmailConfirmBanner />
        {children}
      </main>
    </div>
  );
}
