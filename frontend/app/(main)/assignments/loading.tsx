export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto pb-32">
      <div className="mb-4 flex items-start gap-3">
        <span className="w-3.5 h-3.5 mt-1.5 rounded-full bg-zinc-200 animate-pulse" />
        <div className="flex-1">
          <div className="h-6 w-40 bg-zinc-200 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-72 bg-zinc-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-zinc-100 px-5 py-3 mb-5 h-12 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[180px] rounded-[20px] bg-white border border-zinc-100 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
