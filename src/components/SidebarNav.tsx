"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Users, Calendar, FileText, BookOpen, BarChart3, Settings, GitFork } from "lucide-react";

const navItems = [
  { name: "Inbox", href: "/inbox", icon: MessageSquare },
  { name: "Contactos", href: "/contacts", icon: Users },
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Plantillas", href: "/templates", icon: FileText },
  { name: "Funnels", href: "/funnels", icon: GitFork },
  { name: "Conocimiento", href: "/knowledge", icon: BookOpen },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
  { name: "Configuración", href: "/settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto py-4">
      <ul className="space-y-[2px] px-2 list-none m-0 p-0">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <li key={item.name} className="list-none p-0 m-0">
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all duration-150 relative group ${
                  isActive
                    ? 'text-green-700 dark:text-white bg-green-50 dark:bg-white/10'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-50 dark:bg-white/5'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-green-500 dark:bg-[#25D366]" />
                )}
                <item.icon className={`h-4 w-4 transition-colors ${
                  isActive ? 'text-green-500 dark:text-[#25D366]' : 'text-slate-500 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-200'
                }`} />
                <span>{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
