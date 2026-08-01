'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, DoorOpen, Users } from 'lucide-react';

import { useRooms } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

/** Minimum-capacity thresholds offered by the room filter. */
const CAPACITY_FILTERS = [
  { value: '0', label: 'Any size' },
  { value: '2', label: '2+ people' },
  { value: '4', label: '4+ people' },
  { value: '6', label: '6+ people' },
  { value: '10', label: '10+ people' },
  { value: '15', label: '15+ people' },
];

export default function RoomsPage() {
  const { data: rooms, isPending, isError, refetch } = useRooms();
  const [minCapacity, setMinCapacity] = React.useState(0);

  const visibleRooms = (rooms ?? []).filter((room) => room.capacity >= minCapacity);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meeting rooms</h1>
          <p className="text-sm text-muted-foreground">
            Pick a room to see its schedule and book a slot.
          </p>
        </div>
        {rooms && rooms.length > 0 ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Select
              value={String(minCapacity)}
              onValueChange={(value) => setMinCapacity(Number(value))}
            >
              <SelectTrigger className="w-[150px]" aria-label="Filter rooms by capacity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAPACITY_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton placeholder, never reordered
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="p-8 text-center">
          <p className="mb-4 text-sm text-muted-foreground">Could not load the room list.</p>
          <Button onClick={() => refetch()}>Try again</Button>
        </Card>
      ) : rooms.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <DoorOpen className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No rooms yet</p>
          <p className="text-sm text-muted-foreground">
            Rooms will appear here once they are added.
          </p>
        </Card>
      ) : visibleRooms.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Users className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No rooms fit that capacity</p>
          <p className="text-sm text-muted-foreground">Try a smaller minimum capacity.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRooms.map((room) => (
            <Card key={room.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  {room.name}
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary">
                      <Building2 className="h-3 w-3" />
                      {room.floor}
                    </Badge>
                    <Badge variant="secondary">
                      <Users className="h-3 w-3" />
                      {room.capacity}
                    </Badge>
                  </span>
                </CardTitle>
                <CardDescription>
                  Floor {room.floor} · fits up to {room.capacity}{' '}
                  {room.capacity === 1 ? 'person' : 'people'}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild className="w-full">
                  <Link href={`/rooms/${room.id}`}>
                    Open schedule
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
