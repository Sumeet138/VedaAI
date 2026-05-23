import Sidebar from '@/components/ui/Sidebar';
import Header from '@/components/ui/Header';
import MobileBottomNav from '@/components/ui/MobileBottomNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex overflow-hidden bg-[#f3f3f3]">
      <div className="hidden md:flex z-20">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col h-screen overflow-hidden z-10">
        <Header />
        <main className="flex-1 overflow-y-auto relative">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
