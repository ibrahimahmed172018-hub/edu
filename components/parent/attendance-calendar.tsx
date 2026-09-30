import * as React from 'react';
import { CheckCircle2, Clock, XCircle, AlertCircle, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export interface AttendanceRecord {
  id: string;
  date: string;
  sessionTitle?: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  timeIn?: string;
  notes?: string;
}

export interface AttendanceCalendarProps {
  records: AttendanceRecord[];
}

export function AttendanceCalendar({ records }: AttendanceCalendarProps) {
  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Present
          </Badge>
        );
      case 'late':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3.5 w-3.5" /> Late
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3.5 w-3.5" /> Absent
          </Badge>
        );
      case 'excused':
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> Excused
          </Badge>
        );
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Attendance History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No attendance records logged yet for this student.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Date(record.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>{record.sessionTitle || 'Regular Lesson'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.timeIn || '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {record.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
