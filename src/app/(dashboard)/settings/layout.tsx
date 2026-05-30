import Link from "next/link";

const settingsNav = [
  { name: "Workspace", href: "/settings/workspace" },
  { name: "WhatsApp", href: "/settings/whatsapp" },
  { name: "Miembros", href: "/settings/members" },
  { name: "Webhooks", href: "/settings/webhooks" },
  { name: "Agente IA", href: "/settings/ai-agent" },
  { name: "Disponibilidad", href: "/settings/availability" },
  { name: "Resp. Rápidas", href: "/settings/quick-replies" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <aside className="w-44 border-r border-white/10 bg-[#0a0a0a] shrink-0">
        <div className="py-6 px-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 px-3 mb-3">Configuración</p>
          <nav className="space-y-[2px]">
            {settingsNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
