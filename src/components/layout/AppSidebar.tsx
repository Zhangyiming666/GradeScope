import { BookOpen, Database, Home } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../config/ui'
import { cn } from '../../utils/cn'

const icons = [Home, BookOpen, Database]

export function AppSidebar() {
  return (
    <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-[216px] shrink-0 border-r border-line bg-white px-4 py-6 md:block">
      <nav className="space-y-2" aria-label="主导航">
        {navigationItems.map((item, index) => {
          const Icon = icons[index]
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-medium text-text transition-all duration-200 ease-out hover:bg-primary-soft hover:text-primary active:scale-[0.98]',
                  isActive && 'bg-primary-soft text-primary shadow-sm'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-transform duration-200 ease-out group-hover:scale-110',
                      isActive && 'scale-110'
                    )}
                    aria-hidden="true"
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}

export function AppBottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
      aria-label="主导航"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        {navigationItems.map((item, index) => {
          const Icon = icons[index]
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-xs font-medium text-text transition-all duration-200 ease-out hover:bg-primary-soft hover:text-primary active:scale-[0.98]',
                  isActive && 'bg-primary-soft text-primary shadow-sm'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-transform duration-200 ease-out group-hover:scale-110',
                      isActive && 'scale-110'
                    )}
                    aria-hidden="true"
                  />
                  <span className="max-w-full truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
