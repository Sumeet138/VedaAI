'use client';

import { usePathname } from 'next/navigation';
import { LayoutGrid, Bell, ChevronDown, Menu, FileText, Users, Smartphone, BookOpen } from 'lucide-react';

const TeacherAvatar = () => (
  <svg viewBox="0 0 100 100" className="w-8 h-8 rounded-full shrink-0 bg-amber-100 border border-amber-200 shadow-sm">
    {/* Hair */}
    <path d="M 22 50 C 22 25, 78 25, 78 50 C 78 55, 74 60, 74 65 L 26 65 C 26 60, 22 55, 22 50 Z" fill="#854d0e" />
    
    {/* Face */}
    <circle cx="50" cy="52" r="21" fill="#fef08a" />
    
    {/* Hair bangs */}
    <path d="M 32 40 Q 50 32 68 40 Q 50 48 32 40" fill="#854d0e" />
    
    {/* Eyes */}
    <circle cx="43" cy="52" r="2.5" fill="#1c1917" />
    <circle cx="57" cy="52" r="2.5" fill="#1c1917" />
    
    {/* Mouth */}
    <path d="M 45 61 Q 50 65 55 61" stroke="#a16207" strokeWidth="1.8" fill="none" strokeLinecap="round" />

    {/* Glasses */}
    <circle cx="43" cy="52" r="6" stroke="#451a03" strokeWidth="1.5" fill="none" />
    <circle cx="57" cy="52" r="6" stroke="#451a03" strokeWidth="1.5" fill="none" />
    <line x1="49" y1="52" x2="51" y2="52" stroke="#451a03" strokeWidth="1.5" />
    
    {/* Clothes/Collar */}
    <path d="M 36 73 L 50 82 L 64 73" stroke="#e11d48" strokeWidth="3" fill="none" />
  </svg>
);

export default function Header() {
  const pathname = usePathname();

  const getPageInfo = () => {
    if (pathname === '/') return { title: 'Home', icon: LayoutGrid };
    if (pathname.startsWith('/assignments')) return { title: 'Assignments', icon: FileText };
    if (pathname.startsWith('/groups')) return { title: 'My Groups', icon: Users };
    if (pathname.startsWith('/toolkit')) return { title: "AI Teacher's Toolkit", icon: Smartphone };
    if (pathname.startsWith('/library')) return { title: 'My Library', icon: BookOpen };
    return { title: 'Overview', icon: LayoutGrid };
  };

  const { title, icon: Icon } = getPageInfo();

  return (
    <>
      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between bg-white rounded-2xl px-5 py-2.5 border border-zinc-200/50 shadow-sm mx-6 mt-5 select-none">
        {/* Left side: Dynamic Title */}
        <div className="flex items-center gap-2.5 text-zinc-400 font-medium text-[15px] pl-2">
          <Icon className="w-5 h-5 text-zinc-400" />
          <span className="text-zinc-700 font-bold">{title}</span>
        </div>

        {/* Right side: Bell icon and User dropdown profile */}
        <div className="flex items-center gap-4">
          {/* Bell Icon with Red badge */}
          <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-600 hover:text-zinc-800 transition-colors">
            <Bell className="w-[20px] h-[20px] stroke-[2]" />
            {/* Notification red dot badge */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border border-white" />
          </button>

          {/* Vertical divider */}
          <div className="h-6 w-px bg-zinc-200/60" />

          {/* Profile Card dropdown */}
          <button className="flex items-center gap-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-full pl-1.5 pr-3.5 py-1 border border-zinc-200/30 hover:border-zinc-300/60 transition-all select-none group">
            <TeacherAvatar />
            <span className="text-[14px] font-semibold text-zinc-800 tracking-tight group-hover:text-zinc-900">
              John Doe
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="flex md:hidden items-center justify-between bg-white mx-4 mt-4 mb-2 pl-3 pr-4 h-14 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.06)] select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-[38px] h-[38px] bg-[#2d2d2d] rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white font-black text-[22px] tracking-tighter font-sans">V</span>
          </div>
          <svg width="86" height="21" viewBox="0 0 86 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-auto text-zinc-900">
            <path d="M6.10409 20.02L9.37805e-05 1.53999H4.39609L8.76409 16.604H9.12809L13.5241 1.53999H17.8641L11.7321 20.02H6.10409ZM24.0234 20.412C22.8101 20.412 21.7274 20.244 20.7754 19.908C19.8421 19.572 19.0488 19.0867 18.3954 18.452C17.7421 17.8173 17.2381 17.0333 16.8834 16.1C16.5474 15.1667 16.3794 14.112 16.3794 12.936C16.3794 11.7787 16.5381 10.7147 16.8554 9.74399C17.1914 8.75466 17.6768 7.90532 18.3114 7.19599C18.9461 6.46799 19.7208 5.90799 20.6354 5.51599C21.5501 5.12399 22.5861 4.92799 23.7434 4.92799C24.8634 4.92799 25.8621 5.11465 26.7394 5.48799C27.6168 5.84266 28.3448 6.38399 28.9234 7.11199C29.5208 7.83999 29.9501 8.73599 30.2114 9.79999C30.4914 10.8453 30.5941 12.0493 30.5194 13.412L18.9834 13.524V11.312L28.1954 11.228L26.7674 12.348C26.8981 11.3587 26.8328 10.5467 26.5714 9.91199C26.3101 9.27732 25.9274 8.81066 25.4234 8.51199C24.9381 8.21332 24.3968 8.06399 23.7994 8.06399C23.0901 8.06399 22.4648 8.25066 21.9234 8.62399C21.3821 8.99732 20.9621 9.54799 20.6634 10.276C20.3648 10.9853 20.2154 11.844 20.2154 12.852C20.2154 14.4387 20.5608 15.6053 21.2514 16.352C21.9608 17.0987 22.8848 17.472 24.0234 17.472C24.5461 17.472 24.9848 17.4067 25.3394 17.276C25.7128 17.1267 26.0114 16.94 26.2354 16.716C26.4781 16.492 26.6648 16.24 26.7954 15.96C26.9448 15.68 27.0661 15.4 27.1594 15.12L30.6594 15.876C30.4914 16.5667 30.2394 17.192 29.9034 17.752C29.5861 18.2933 29.1568 18.7693 28.6154 19.18C28.0741 19.572 27.4208 19.8707 26.6554 20.076C25.9088 20.3 25.0314 20.412 24.0234 20.412ZM37.3204 20.412C36.0884 20.412 35.0057 20.0947 34.0724 19.46C33.1577 18.8253 32.4484 17.9293 31.9444 16.772C31.4404 15.6147 31.1884 14.2427 31.1884 12.656C31.1884 11.1627 31.4124 9.83732 31.8604 8.67999C32.3084 7.52266 32.971 6.61732 33.8484 5.96399C34.7257 5.31066 35.8177 4.98399 37.1244 4.98399C38.0764 4.98399 38.879 5.16132 39.5324 5.51599C40.1857 5.87066 40.7177 6.39332 41.1284 7.08399C41.5577 7.75599 41.8937 8.56799 42.1364 9.51999H42.7804C42.6497 8.92266 42.5284 8.34399 42.4164 7.78399C42.323 7.20532 42.2484 6.65466 42.1924 6.13199C42.1364 5.60932 42.1084 5.15199 42.1084 4.75999V-1.19209e-05H46.1404V12.796V20.02H42.7804V15.764H42.2204C42.015 16.8093 41.6977 17.6773 41.2684 18.368C40.839 19.0587 40.2884 19.572 39.6164 19.908C38.963 20.244 38.1977 20.412 37.3204 20.412ZM38.6644 17.108C39.2804 17.108 39.803 16.9773 40.2324 16.716C40.6617 16.4547 41.0164 16.1187 41.2964 15.708C41.5764 15.2787 41.7817 14.8213 41.9124 14.336C42.043 13.832 42.1084 13.3653 42.1084 12.936V12.404C42.1084 12.0493 42.0524 11.6853 41.9404 11.312C41.847 10.92 41.707 10.5373 41.5204 10.164C41.3337 9.79066 41.1004 9.46399 40.8204 9.18399C40.5404 8.88532 40.2137 8.65199 39.8404 8.48399C39.467 8.31599 39.0564 8.23199 38.6084 8.23199C37.9364 8.23199 37.367 8.41865 36.9004 8.79199C36.4337 9.16532 36.0697 9.68799 35.8084 10.36C35.547 11.0133 35.4164 11.7787 35.4164 12.656C35.4164 13.552 35.547 14.336 35.8084 15.008C36.0884 15.68 36.471 16.2027 36.9564 16.576C37.4417 16.9307 38.011 17.108 38.6644 17.108ZM51.6192 20.412C50.7979 20.412 50.0699 20.2533 49.4352 19.936C48.8005 19.6 48.3059 19.124 47.9512 18.508C47.5965 17.892 47.4192 17.1267 47.4192 16.212C47.4192 15.4093 47.5685 14.7373 47.8672 14.196C48.1845 13.6547 48.6419 13.216 49.2392 12.88C49.8365 12.544 50.5739 12.264 51.4512 12.04C52.3285 11.816 53.3272 11.62 54.4472 11.452C55.0445 11.3587 55.5299 11.2747 55.9032 11.2C56.2952 11.1067 56.5845 10.9667 56.7712 10.78C56.9579 10.5747 57.0512 10.2853 57.0512 9.91199C57.0512 9.38932 56.8645 8.94132 56.4912 8.56799C56.1179 8.19466 55.5299 8.00799 54.7272 8.00799C54.1859 8.00799 53.6819 8.10132 53.2152 8.28799C52.7672 8.47466 52.3752 8.75466 52.0392 9.12799C51.7219 9.50132 51.4885 9.97732 51.3392 10.556L47.7832 9.46399C48.0072 8.69866 48.3245 8.03599 48.7352 7.47599C49.1645 6.91599 49.6779 6.44932 50.2752 6.07599C50.8725 5.68399 51.5539 5.39465 52.3192 5.20799C53.0845 5.02132 53.9152 4.92799 54.8112 4.92799C56.2485 4.92799 57.4152 5.16132 58.3112 5.62799C59.2259 6.07599 59.9072 6.78532 60.3552 7.75599C60.8032 8.70799 61.0272 9.93999 61.0272 11.452V13.972C61.0272 14.6253 61.0365 15.288 61.0552 15.96C61.0925 16.632 61.1299 17.3133 61.1672 18.004C61.2232 18.676 61.2792 19.348 61.3352 20.02H57.7792C57.7045 19.5533 57.6299 19.0213 57.5552 18.424C57.4992 17.808 57.4525 17.192 57.4152 16.576H56.9112C56.6499 17.2853 56.2765 17.9293 55.7912 18.508C55.3059 19.0867 54.7085 19.5533 53.9992 19.908C53.3085 20.244 52.5152 20.412 51.6192 20.412ZM53.3272 17.5C53.6819 17.5 54.0365 17.4347 54.3912 17.304C54.7645 17.1733 55.1192 16.996 55.4552 16.772C55.8099 16.5293 56.1272 16.2307 56.4072 15.876C56.7059 15.5213 56.9485 15.12 57.1352 14.672L57.0792 12.32L57.7232 12.46C57.3872 12.7027 56.9952 12.8987 56.5472 13.048C56.0992 13.1787 55.6325 13.2813 55.1472 13.356C54.6805 13.4307 54.2139 13.5147 53.7472 13.608C53.2805 13.7013 52.8605 13.8227 52.4872 13.972C52.1325 14.1213 51.8432 14.3267 51.6192 14.588C51.4139 14.8307 51.3112 15.176 51.3112 15.624C51.3112 16.2027 51.4979 16.66 51.8712 16.996C52.2445 17.332 52.7299 17.5 53.3272 17.5ZM61.5301 20.02L67.8581 1.53999H73.7381L80.0661 20.02H75.6981L71.0221 4.73199H70.6021L65.8981 20.02H61.5301ZM65.0861 16.38V13.636H77.0981V16.38H65.0861ZM80.9409 20.02V1.53999H85.0569V20.02H80.9409Z" fill="currentColor"/>
          </svg>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative flex items-center justify-center w-10 h-10 bg-[#f4f4f4] rounded-full">
            <Bell className="w-[20px] h-[20px] text-zinc-800 stroke-[2]" />
            <span className="absolute top-[2px] right-[2px] w-[9px] h-[9px] bg-[#ff5722] rounded-full border-2 border-white" />
          </button>
          <img src="https://i.pravatar.cc/150?img=11" alt="Profile" className="w-10 h-10 rounded-full object-cover shadow-sm" />
          <button>
            <Menu className="w-6 h-6 text-zinc-900 stroke-[2.5]" />
          </button>
        </div>
      </header>
    </>
  );
}
