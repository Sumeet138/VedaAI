export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="h-6 w-32 bg-zinc-100 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-full bg-zinc-100 animate-pulse" />
          <div className="h-9 w-28 rounded-full bg-zinc-200 animate-pulse" />
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-zinc-200 px-12 py-10">
        <div className="text-center mb-6 space-y-2">
          <div className="h-6 w-2/3 mx-auto bg-zinc-200 rounded animate-pulse" />
          <div className="h-4 w-1/3 mx-auto bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-zinc-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
