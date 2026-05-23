import Link from 'next/link';
import { FileSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mb-5 border border-zinc-200">
        <FileSearch className="w-7 h-7 text-zinc-400" />
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-2">Page not found</h2>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/assignments"
        className="bg-zinc-900 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
      >
        Go to Assignments
      </Link>
    </div>
  );
}
