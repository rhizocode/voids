import { NavLink, Outlet } from 'react-router-dom';
import { cn } from './ui';

const navItems = [
  { to: '/', label: 'Status', end: true },
  { to: '/config', label: 'Configuration' },
  { to: '/libraries', label: 'Libraries' },
  { to: '/recommended', label: 'Recommended' },
  { to: '/mislabeled', label: 'Mislabeled' },
  { to: '/rss', label: 'RSS' },
  { to: '/about', label: 'About' },
];

export function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/50 p-5 sm:flex">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Voids</h1>
          <p className="mt-1 text-xs text-slate-400">Find the gaps in your movie collections</p>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top nav */}
        <header className="border-b border-slate-800 bg-slate-900/50 p-4 sm:hidden">
          <h1 className="text-xl font-bold text-white">Voids</h1>
          <nav className="mt-3 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2 py-1 text-xs font-medium',
                    isActive ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
