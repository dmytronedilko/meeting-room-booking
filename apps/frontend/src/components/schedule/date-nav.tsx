'use client';

import * as React from 'react';
import { format, parse } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DAYS_PER_WEEK } from '@office/shared';

import { addDaysToDate, formatWeekRange, officeToday, weekStartOf } from '@/lib/schedule';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface WeekNavProps {
  /** Monday of the displayed week (`YYYY-MM-DD`). */
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
}

export function WeekNav({ weekStart, onWeekChange }: WeekNavProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parse(weekStart, 'yyyy-MM-dd', new Date());
  const isCurrentWeek = weekStart === weekStartOf(officeToday());

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous week"
        onClick={() => onWeekChange(addDaysToDate(weekStart, -DAYS_PER_WEEK))}
      >
        <ChevronLeft />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[150px] justify-start font-normal sm:w-[210px]">
            <CalendarIcon className="text-muted-foreground" />
            {formatWeekRange(weekStart)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            weekStartsOn={1}
            onSelect={(day) => {
              if (day) {
                onWeekChange(weekStartOf(format(day, 'yyyy-MM-dd')));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        aria-label="Next week"
        onClick={() => onWeekChange(addDaysToDate(weekStart, DAYS_PER_WEEK))}
      >
        <ChevronRight />
      </Button>

      {!isCurrentWeek ? (
        <Button variant="ghost" onClick={() => onWeekChange(weekStartOf(officeToday()))}>
          This week
        </Button>
      ) : null}
    </div>
  );
}
