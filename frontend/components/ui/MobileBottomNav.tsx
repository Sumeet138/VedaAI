'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/', iconSrc: '/svg/dashboard-icon.svg' },
    { label: 'Assignments', href: '/assignments', iconSrc: '/svg/assignemnt-svg.svg' },
    { label: 'Library', href: '/library', iconSrc: '/svg/my-library-svg.svg' },
    { label: 'AI Toolkit', href: '/toolkit', iconSrc: '/svg/toolkit-svg.svg' },
  ];

  return (
    <nav className="md:hidden fixed bottom-8 left-4 right-4 bg-[#1c1c1c] text-[#7a7a7a] rounded-[28px] flex justify-between items-center px-6 py-4 z-50 shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
      {navItems.map((item) => {
        const isActive = (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center gap-1.5 transition-all ${isActive ? 'text-white' : 'text-[#7a7a7a]'}`}
          >
            <img
              src={item.iconSrc}
              alt=""
              width={20}
              height={20}
              className="shrink-0"
              style={{ filter: 'invert(1)', opacity: isActive ? 1 : 0.5 }}
            />
            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
