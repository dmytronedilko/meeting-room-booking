'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { OFFICE_TIME_ZONE, WORK_DAY_END_HOUR, WORK_DAY_START_HOUR } from '@office/shared';
import { ArrowLeft, Building2, Users } from 'lucide-react';

import { officeToday, weekStartOf } from '@/lib/schedule';
import { useRooms } from '@/lib/hooks';
import { useUserTimeZone, timeZoneLabel, rendersInOfficeTime } from '@/lib/timezone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WeekNav } from '@/components/schedule/date-nav';
import { ScheduleGrid } from '@/components/schedule/schedule-grid';

export default function RoomSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  // Next 15+ delivers route params as a Promise; unwrap it in this client
  // component with React.use(). useSearchParams also requires the Suspense
  // boundary below during static rendering.
  const { id } = React.use(params);
  return (
    <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <RoomSchedule roomId={id} />
    </React.Suspense>
  );
}

function RoomSchedule({ roomId }: { roomId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // "?date=YYYY-MM-DD" deep-links to the week containing that day (used by
  // the "My bookings" page); default is the current week.
  const dateParam = searchParams.get('date');
  const initialDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : officeToday();
  const [weekStart, setWeekStart] = React.useState(() => weekStartOf(initialDate));

  const changeWeek = (nextWeekStart: string) => {
    setWeekStart(nextWeekStart);
    router.replace(`${pathname}?date=${nextWeekStart}`, { scroll: false });
  };

  const { data: rooms, isPending } = useRooms();
  const room = rooms?.find((candidate) => candidate.id === roomId);

  // Times are rendered in the viewer's own zone; flag it when that differs from
  // office time so the working-hours label isn't misread.
  const userTimeZone = useUserTimeZone();
  const viewingInOfficeZone = rendersInOfficeTime(userTimeZone);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to rooms">
            <Link href="/">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            {isPending ? (
              <Skeleton className="h-7 w-40" />
            ) : (
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
                {room?.name ?? 'Unknown room'}
                {room ? (
                  <>
                    <Badge variant="secondary">
                      <Building2 className="h-3 w-3" />
                      Floor {room.floor}
                    </Badge>
                    <Badge variant="secondary">
                      <Users className="h-3 w-3" />
                      {room.capacity}
                    </Badge>
                  </>
                ) : null}
              </h1>
            )}
            <p className="text-sm text-muted-foreground">
              Working hours {String(WORK_DAY_START_HOUR).padStart(2, '0')}:00–{WORK_DAY_END_HOUR}:00{' '}
              office time ({timeZoneLabel(OFFICE_TIME_ZONE)}) · 30-minute slots
            </p>
            {!viewingInOfficeZone ? (
              <p className="text-xs text-muted-foreground">
                Times below are shown in your time zone ({timeZoneLabel(userTimeZone)}).
              </p>
            ) : null}
          </div>
        </div>
        <WeekNav weekStart={weekStart} onWeekChange={changeWeek} />
      </div>

      <ScheduleGrid roomId={roomId} roomName={room?.name ?? ''} weekStart={weekStart} />
    </div>
  );
}
