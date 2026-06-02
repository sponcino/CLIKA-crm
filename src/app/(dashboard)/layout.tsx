import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav } from "@/components/SidebarNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased selection:bg-whatsapp/30">
      {/* Sidebar — always dark regardless of theme */}
      <aside className="w-[220px] bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] hidden md:flex flex-col flex-shrink-0">
        <div className="h-12 flex items-center px-4 font-bold text-lg tracking-tight border-b border-[var(--border-color)] text-[var(--sidebar-text)]">
          CLIKA<span className="h-1.5 w-1.5 rounded-full bg-whatsapp ml-1 self-center"></span>
        </div>

        <SidebarNav />

        {/* Bottom Panel */}
        <div className="p-3 border-t border-white/10 bg-black/20 flex flex-col gap-2">
          <div className="text-[11px] text-gray-500 font-medium px-2 uppercase tracking-wider truncate">
            Demo Workspace
          </div>
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7 border border-white/15">
                <AvatarFallback className="bg-whatsapp/10 text-whatsapp text-xs font-semibold">
                  {session.user.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-gray-300 truncate max-w-[100px]">
                {session.user.name}
              </span>
            </div>
            <form action={async () => {
              "use server"
              await signOut()
            }}>
              <button className="text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-12 flex-shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-color)] flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <GlobalSearch />
            <div className="text-xs font-semibold text-[var(--text-secondary)]">
              Workspace: <span className="text-[var(--text-primary)]">Demo Workspace</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6 border border-[var(--border-color)]">
                <AvatarFallback className="bg-whatsapp/10 text-whatsapp text-[10px] font-semibold">
                  {session.user.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-[var(--text-secondary)] hidden sm:block">
                {session.user.name}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden relative bg-[var(--bg-primary)]">
          {children}
        </main>
      </div>
    </div>
  );
}
