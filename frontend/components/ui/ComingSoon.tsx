export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[65vh] px-4 md:px-8 py-4 md:py-6 animate-in fade-in zoom-in duration-500">
      <img src="/coming-soon.png" alt="Coming Soon" className="w-[180px] md:w-[240px] opacity-90 drop-shadow-sm mb-6" />
      <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-800 tracking-tight text-center">{title} is Coming Soon!</h2>
      <p className="mt-3 text-[14px] md:text-[15px] text-zinc-500 font-medium text-center max-w-sm leading-relaxed">
        We're working hard in the lab to bring this exciting new feature to life. Stay tuned for updates!
      </p>
    </div>
  );
}
