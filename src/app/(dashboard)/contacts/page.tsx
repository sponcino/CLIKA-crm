"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Megaphone, Tag } from "lucide-react"
import { useState } from "react"

const STATUS_STYLES: Record<string, string> = {
  NEW:                  "bg-whatsapp/10 text-whatsapp border border-whatsapp/20",
  CONTACTED:            "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  QUALIFIED:            "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  INTERESTED:           "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  APPOINTMENT_SCHEDULED:"bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  PROPOSAL_SENT:        "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  WON:                  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  LOST:                 "bg-red-500/10 text-red-400 border border-red-500/20",
}

export default function ContactsPage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { data: [] }
      const res = await fetch(`/api/contacts?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: !!workspaceId,
  })

  const handleExport = () => {
    window.open("/api/contacts/export", "_blank")
  }

  const allContacts = data?.data ?? []
  const filtered = allContacts.filter((c: any) => { // eslint-disable-line
    const q = search.toLowerCase()
    return !q
      || c.whatsappName?.toLowerCase().includes(q)
      || c.fullName?.toLowerCase().includes(q)
      || c.whatsappPhone?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q)
  })

  return (
    <div className="p-8 w-full h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Contactos</h1>
          <p className="text-xs text-gray-500 mt-0.5">{allContacts.length} contactos en total</p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-[#ffffff15] bg-transparent text-gray-300 hover:bg-white/5 hover:text-white text-xs h-8 px-3"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            className="pl-8 bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp focus-visible:border-whatsapp rounded-md transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border-color)] rounded-md flex-1 overflow-auto bg-[var(--bg-secondary)] scrollbar-thin">
        <Table>
          <TableHeader className="bg-[var(--bg-primary)]">
            <TableRow className="hover:bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
              <TableHead className="text-[var(--text-secondary)] font-semibold h-10">Nombre</TableHead>
              <TableHead className="text-[var(--text-secondary)] font-semibold h-10">Teléfono</TableHead>
              <TableHead className="text-[var(--text-secondary)] font-semibold h-10">Estado</TableHead>
              <TableHead className="text-[var(--text-secondary)] font-semibold h-10">Lead Score</TableHead>
              <TableHead className="text-[var(--text-secondary)] font-semibold h-10">Campaña / Anuncio</TableHead>
              <TableHead className="text-[var(--text-secondary)] font-semibold h-10">Último Mensaje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-gray-500">Cargando contactos...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-gray-500">No se encontraron contactos.</TableCell>
              </TableRow>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              filtered.map((contact: any) => (
                <TableRow key={contact.id} className="border-b border-[var(--border-color)] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 bg-[var(--bg-secondary)] transition-all">
                  <TableCell className="py-3">
                    <div>
                      <p className="font-semibold text-white">
                        {contact.whatsappName || contact.fullName || "Desconocido"}
                      </p>
                      {contact.email && (
                        <p className="text-[10px] text-gray-500 mt-0.5">{contact.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300 py-3 font-mono text-xs">{contact.whatsappPhone}</TableCell>
                  <TableCell className="py-3">
                    <Badge className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${STATUS_STYLES[contact.status] ?? "bg-gray-500/10 text-gray-400 border border-gray-500/20"}`}>
                      {contact.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 bg-[#ffffff10] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-whatsapp rounded-full transition-all"
                          style={{ width: `${Math.min(100, contact.leadScore)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{contact.leadScore}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-0.5">
                      {contact.campaignId ? (
                        <div className="flex items-center gap-1 text-[10px] text-indigo-400">
                          <Megaphone className="h-2.5 w-2.5" />
                          <span className="font-mono truncate max-w-[100px]">{contact.campaignId}</span>
                        </div>
                      ) : null}
                      {contact.adId ? (
                        <div className="flex items-center gap-1 text-[10px] text-purple-400">
                          <Tag className="h-2.5 w-2.5" />
                          <span className="font-mono truncate max-w-[100px]">{contact.adId}</span>
                        </div>
                      ) : null}
                      {!contact.campaignId && !contact.adId && (
                        <span className="text-[10px] text-gray-600">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-400 py-3 text-xs">
                    {contact.lastMessageAt ? new Date(contact.lastMessageAt).toLocaleDateString("es-AR") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
