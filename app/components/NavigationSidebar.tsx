import React from 'react';
import { RiDashboardLine, RiHistoryLine, RiMessage3Line, RiBellLine, RiUserLine, RiToolsFill, RiLogoutBoxLine } from 'react-icons/ri';
import { signOut } from 'next-auth/react';
import Image from 'next/image';

interface NavigationSidebarProps {
  setPage: (page: number) => void;
  currentPage: number;
}

const NavigationSidebar = ({ setPage, currentPage }: NavigationSidebarProps) => {
  const navItems = [
    { id: 0, label: 'Dashboard', icon: RiDashboardLine },
    { id: 1, label: 'Billing History', icon: RiHistoryLine },
    { id: 5, label: 'Maintenance', icon: RiToolsFill },
    { id: 2, label: 'Messages', icon: RiMessage3Line },
    { id: 3, label: 'Notifications', icon: RiBellLine },
    { id: 4, label: 'Profile', icon: RiUserLine },
  ];

  const handleLogout = async () => {
    try {
      // Call logout endpoint to update isOnline status
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Sign out regardless of logout endpoint result
      await signOut({ callbackUrl: '/' });
    }
  };

  return (
    <div className="hidden lg:flex flex-col w-64 h-full bg-customViolet text-white shrink-0 transition-all duration-300">
      <div className="p-6 flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Co-Living Logo"
          height={40}
          width={40}
          className="w-8 h-8 object-contain brightness-0 invert"
        />
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2 text-xs font-semibold text-white/60 uppercase tracking-wider">
          Menu
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-medium transition-colors duration-200 ${
                  isActive 
                    ? 'bg-white text-customViolet shadow-md' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="text-base" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-200"
        >
          <RiLogoutBoxLine className="text-lg" />
          Log Out
        </button>
      </div>
    </div>
  );
};

export default NavigationSidebar;
