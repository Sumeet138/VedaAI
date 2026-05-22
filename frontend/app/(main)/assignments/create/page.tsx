import AssignmentForm from '@/components/assignments/AssignmentForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CreateAssignmentPage() {
  return (
    <div className="w-full px-4 md:px-8 py-4 md:py-6">
      {/* Page Header */}
      <div className="mb-6">
        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#10b981]" />
            <h1 className="text-xl font-bold text-zinc-800 tracking-tight">Create Assignment</h1>
          </div>
          <p className="text-[13px] text-zinc-500 font-medium ml-5">
            Set up a new assignment for your students
          </p>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center relative py-1">
          <Link href="/assignments" className="w-[42px] h-[42px] flex items-center justify-center bg-[#E8E8E8] hover:bg-[#dcdcdc] rounded-full shrink-0 transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-800 stroke-[2.5]" />
          </Link>
          <h1 className="flex-1 text-center text-[18px] font-bold text-zinc-800 pr-[42px]">Create Assignment</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <AssignmentForm />
      </div>
    </div>
  );
}
