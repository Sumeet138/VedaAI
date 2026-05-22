export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto py-2">
      <div className="mb-4">
        <div className="h-6 w-44 bg-zinc-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
      </div>
      <div className="mb-8 h-1.5 w-full bg-zinc-200 rounded-full" />
      <div className="bg-white rounded-3xl border border-zinc-100 p-8 space-y-6">
        <div className="h-40 rounded-2xl bg-zinc-50 border-2 border-dashed border-zinc-200 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 rounded-xl bg-zinc-50 animate-pulse" />
          <div className="h-12 rounded-xl bg-zinc-50 animate-pulse" />
        </div>
        <div className="h-12 rounded-xl bg-zinc-50 animate-pulse" />
        <div className="h-12 rounded-xl bg-zinc-50 animate-pulse" />
        <div className="h-24 rounded-2xl bg-zinc-50 animate-pulse" />
      </div>
    </div>
  );
}
