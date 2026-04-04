import { Menu, Bell, Search } from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { useCredits } from '@hooks/useCredits';
import { cn } from '@utils/helpers';
import { useTheme } from '@context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function Header({ onMenuClick }) {
  const { user }               = useAuth();
  const { remaining, usagePct } = useCredits();
  const { isDark, toggle } = useTheme();

  const creditColor = usagePct >= 80 ? 'text-red-600' : usagePct >= 50 ? 'text-amber-600' : 'text-green-600';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      {/* Left */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Credits pill */}
        <div className="hidden sm:flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
          <div className={cn('text-xs font-semibold', creditColor)}>
            {remaining} credits
          </div>
          <div className="w-16 h-1.5 bg-gray-300 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                usagePct >= 80 ? 'bg-red-500' : usagePct >= 50 ? 'bg-amber-500' : 'bg-green-500'
              )}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
            />
          </div>
        </div>

        {/* Plan badge */}
        <span className={cn(
          'hidden sm:inline-flex badge text-xs',
          user?.plan === 'pro'  ? 'badge-blue' :
          user?.plan === 'team' ? 'badge-purple' : 'badge-gray'
        )}>
          {user?.plan || 'free'}
        </span>

        {/* Notifications */}
        <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative">
          <Bell className="w-5 h-5" />
        </button>
        
        <button
  onClick={toggle}
  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
>
  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
</button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer">
          {user?.profile?.firstName?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}