'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, Sparkles } from 'lucide-react';

const AssignmentActiveIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 4C6.89543 4 6 4.89543 6 6V18C6 19.1046 6.89543 20 8 20H16C17.1046 20 18 19.1046 18 18V6C18 4.89543 17.1046 4 16 4H8ZM10 7C10 6.44772 10.4477 6 11 6H13C13.5523 6 14 6.44772 14 7V8H10V7ZM9 14C9 13.4477 9.44772 13 10 13H14C14.5523 13 15 13.4477 15 14C15 14.5523 14.5523 15 14 15H10C9.44772 15 9 14.5523 9 14Z" />
  </svg>
);

const AssignmentInactiveIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="6" y="4" width="12" height="16" rx="2" />
    <path d="M10 4V6H14V4" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/', icon: LayoutGrid, activeIcon: LayoutGrid },
    { label: 'Assignments', href: '/assignments', icon: AssignmentInactiveIcon, activeIcon: AssignmentActiveIcon },
    { label: 'Library', href: '/library', icon: BookOpen, activeIcon: BookOpen },
    { label: 'AI Toolkit', href: '/toolkit', icon: Sparkles, activeIcon: Sparkles },
  ];

  return (
    <nav className="md:hidden fixed bottom-8 left-4 right-4 bg-[#1c1c1c] text-[#7a7a7a] rounded-[28px] flex justify-between items-center px-6 py-4 z-50 shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href) && item.href !== '#' || (item.href === '/' && pathname === '/');
        const Icon = isActive ? item.activeIcon : item.icon;
        
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center gap-1.5 transition-all ${isActive ? 'text-white' : 'hover:text-zinc-300'}`}
          >
            <Icon className={`w-5 h-5 ${isActive && item.label !== 'Assignments' ? 'fill-white/20' : ''}`} />
            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
