import { CalendarClock } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <CalendarClock className="h-6 w-6 text-primary" />
        Meeting Rooms
      </div>
      {children}
    </div>
  );
}
