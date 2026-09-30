import * as React from 'react';
import { User, Phone, GraduationCap, Calendar, CheckCircle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface StudentProfile {
  id: string;
  name: string;
  grade?: string;
  batch?: string;
  parentPhone?: string;
  parentName?: string;
  attendanceRate?: number;
  totalSessions?: number;
  attendedSessions?: number;
  status?: 'active' | 'inactive';
}

export interface StudentHeaderProps {
  student: StudentProfile;
}

export function StudentHeader({ student }: StudentHeaderProps) {
  const attendancePercentage =
    student.attendanceRate ??
    (student.totalSessions && student.totalSessions > 0
      ? Math.round(((student.attendedSessions || 0) / student.totalSessions) * 100)
      : 100);

  return (
    <Card className="overflow-hidden border-2 shadow-sm bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/40 dark:from-slate-900 dark:to-slate-800">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl shadow-inner shrink-0">
              {student.name.slice(0, 2).toUpperCase()}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{student.name}</h1>
                <Badge variant={student.status === 'inactive' ? 'destructive' : 'success'}>
                  {student.status === 'inactive' ? 'Inactive' : 'Active Student'}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                {student.grade && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                    {student.grade}
                  </span>
                )}
                {student.batch && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    {student.batch}
                  </span>
                )}
                {student.parentPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-emerald-600" />
                    {student.parentPhone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-200 dark:border-slate-800">
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attendance Rate</p>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-3xl font-extrabold text-foreground">{attendancePercentage}%</span>
                <CheckCircle className={`h-6 w-6 ${attendancePercentage >= 85 ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <p className="text-xs text-muted-foreground">
                {student.attendedSessions || 0} of {student.totalSessions || 0} sessions
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
