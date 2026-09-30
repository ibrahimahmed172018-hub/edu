'use client';

import * as React from 'react';
import { StudentIdCard, type StudentCardData } from './id-card';
import { Printer, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface IdCardSheetProps {
  students: StudentCardData[];
  title?: string;
}

export function IdCardSheet({ students, title = 'Student Attendance Cards' }: IdCardSheetProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-6">
      {/* Non-printable Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card text-card-foreground print:hidden shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {title}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total cards: {students.length}. Formatted for standard A4 batch printing.
          </p>
        </div>

        <Button onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print All Cards
        </Button>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground print:hidden">
          <p>No student cards to display. Filter by grade or enroll students first.</p>
        </div>
      ) : (
        /* Printable Grid Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 p-2 print:grid print:grid-cols-2 print:gap-4 print:p-0 print:m-0 print:bg-white">
          {students.map((student) => (
            <div key={student.id} className="flex justify-center print:block">
              <StudentIdCard student={student} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
