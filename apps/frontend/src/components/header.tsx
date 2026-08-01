'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, CalendarDays, LogOut } from 'lucide-react';

import { api } from '@/lib/api';
import { clearUser, getStoredUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { NotificationsBell } from '@/components/notifications-bell';
import { ThemeToggle } from '@/components/theme-toggle';

export function Header() {
  const router = useRouter();
  const [userName, setUserName] = React.useState<string | null>(null);

  React.useEffect(() => {
    setUserName(getStoredUser()?.name ?? null);
  }, []);

  const logout = async () => {
    // Only the server can clear the HttpOnly cookie.
    await api.logout().catch(() => undefined);
    clearUser();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-14 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight transition-colors hover:text-primary"
        >
          <CalendarClock className="h-5 w-5 text-primary" />
          Meeting Rooms
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/bookings">
              <CalendarDays />
              <span className="hidden sm:inline">My bookings</span>
            </Link>
          </Button>
          {userName ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
          ) : null}
          <NotificationsBell />
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
