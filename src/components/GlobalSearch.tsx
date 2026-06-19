"use client";

import { useState, useEffect } from "react";
import { Search, MessageSquare, Users, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: session } = useSession();
  const workspaceId = (session?.user as any)?.workspaceId;
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['globalSearch', query, workspaceId],
    queryFn: async () => {
      if (query.length < 2 || !workspaceId) return { contacts: [], messages: [], conversations: [] };
      const res = await fetch(`/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: query.length >= 2 && !!workspaceId,
  });

  const navigateTo = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-xs text-gray-500 bg-white dark:bg-[#111111] hover:bg-[#222] border border-[#ffffff10] px-3 py-1.5 rounded-md transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline-block w-40 text-left">Buscar contactos, mensajes...</span>
        <kbd className="hidden sm:inline-block ml-auto pointer-events-none text-[10px] font-mono bg-[#ffffff10] px-1.5 rounded border border-[#ffffff15] text-slate-500 dark:text-gray-400">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 border-slate-200 dark:border-white/10 bg-[#111] max-w-2xl overflow-hidden shadow-2xl gap-0">
          <div className="flex items-center px-4 py-3 border-b border-white/5 bg-slate-50 dark:bg-[#0a0a0a]">
            <Search className="h-5 w-5 text-slate-500 dark:text-gray-400 mr-3" />
            <Input
              className="flex-1 bg-transparent border-0 shadow-none text-slate-900 dark:text-white focus-visible:ring-0 text-base p-0 placeholder-gray-600 h-auto"
              placeholder="Escribe para buscar en todo el workspace..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {isLoading && <Loader2 className="h-4 w-4 text-whatsapp animate-spin" />}
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-2">
            {!query ? (
              <div className="p-6 text-center text-sm text-gray-600">Empieza a escribir para buscar...</div>
            ) : query.length < 2 ? (
              <div className="p-6 text-center text-sm text-gray-600">Escribe al menos 2 caracteres</div>
            ) : isLoading ? (
              <div className="p-6 text-center text-sm text-gray-600">Buscando...</div>
            ) : (
              <div className="space-y-4 py-2">
                
                {/* Contacts */}
                {data?.contacts?.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Contactos</div>
                    {data.contacts.map((c: any) => (
                      <div 
                        key={c.id} 
                        onClick={() => navigateTo(`/contacts`)}
                        className="flex flex-col px-3 py-2 cursor-pointer rounded-md hover:bg-slate-50 dark:bg-white/5 transition-colors"
                      >
                        <span className="text-sm text-slate-900 dark:text-white font-medium">{c.whatsappName || "Desconocido"}</span>
                        <span className="text-xs text-gray-500 font-mono">{c.whatsappPhone} {c.email ? `• ${c.email}` : ''}</span>
                      </div>
                    ))}
                    <div 
                      onClick={() => navigateTo(`/contacts`)}
                      className="px-3 py-2 text-xs text-whatsapp cursor-pointer hover:underline"
                    >
                      Ver todos los contactos...
                    </div>
                  </div>
                )}

                {/* Conversations */}
                {data?.conversations?.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Conversaciones</div>
                    {data.conversations.map((c: any) => (
                      <div 
                        key={c.id} 
                        onClick={() => navigateTo(`/inbox`)}
                        className="flex flex-col px-3 py-2 cursor-pointer rounded-md hover:bg-slate-50 dark:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-900 dark:text-white font-medium flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-whatsapp" />
                            {c.contact?.whatsappName || c.contact?.whatsappPhone}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {formatDistanceToNow(new Date(c.updatedAt), { locale: es, addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div 
                      onClick={() => navigateTo(`/inbox`)}
                      className="px-3 py-2 text-xs text-whatsapp cursor-pointer hover:underline"
                    >
                      Ver todas las conversaciones...
                    </div>
                  </div>
                )}

                {/* Messages */}
                {data?.messages?.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mensajes</div>
                    {data.messages.map((m: any) => (
                      <div 
                        key={m.id} 
                        onClick={() => navigateTo(`/inbox`)}
                        className="flex flex-col px-3 py-2 cursor-pointer rounded-md hover:bg-slate-50 dark:bg-white/5 transition-colors"
                      >
                        <span className="text-xs text-slate-500 dark:text-gray-400 font-medium mb-1">
                          De: {m.conversation?.contact?.whatsappName || m.conversation?.contact?.whatsappPhone}
                        </span>
                        <p className="text-sm text-slate-900 dark:text-white truncate">{m.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {data?.contacts?.length === 0 && data?.conversations?.length === 0 && data?.messages?.length === 0 && (
                  <div className="p-6 text-center text-sm text-gray-600">No se encontraron resultados para "{query}"</div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
