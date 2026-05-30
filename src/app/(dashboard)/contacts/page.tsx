"use client"

import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export default function ContactsPage() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { data: [] }
      const res = await fetch(`/api/contacts?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: !!workspaceId
  })

  return (
    <div className="p-8 w-full h-full flex flex-col bg-[#0a0a0a] text-white font-sans antialiased">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Contactos</h1>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input 
            placeholder="Buscar por nombre o teléfono..." 
            className="pl-8 bg-[#111111] border-[#ffffff10] text-white placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp focus-visible:border-whatsapp rounded-md transition-all duration-150"
          />
        </div>
      </div>

      <div className="border border-[#ffffff10] rounded-md flex-1 overflow-auto bg-[#111111] scrollbar-thin">
        <Table>
          <TableHeader className="bg-[#0a0a0a]">
            <TableRow className="hover:bg-[#0a0a0a] border-b border-[#ffffff10]">
              <TableHead className="text-gray-400 font-semibold h-10">Nombre</TableHead>
              <TableHead className="text-gray-400 font-semibold h-10">Teléfono</TableHead>
              <TableHead className="text-gray-400 font-semibold h-10">Estado</TableHead>
              <TableHead className="text-gray-400 font-semibold h-10">Lead Score</TableHead>
              <TableHead className="text-gray-400 font-semibold h-10">Último Mensaje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-b border-[#ffffff05]">
                <TableCell colSpan={5} className="text-center h-24 text-gray-500">
                  Cargando contactos...
                </TableCell>
              </TableRow>
            ) : data?.data?.length === 0 ? (
              <TableRow className="border-b border-[#ffffff05]">
                <TableCell colSpan={5} className="text-center h-24 text-gray-500">
                  No se encontraron contactos.
                </TableCell>
              </TableRow>
            ) : data?.data?.map((contact: { id: string, whatsappName: string, fullName: string, whatsappPhone: string, status: string, leadScore: number, lastMessageAt: string }) => (
              <TableRow key={contact.id} className="border-b border-[#ffffff05] cursor-pointer hover:bg-[#ffffff06] bg-[#111111] transition-all duration-150">
                <TableCell className="font-semibold text-white py-3">{contact.whatsappName || contact.fullName || "Desconocido"}</TableCell>
                <TableCell className="text-gray-300 py-3">{contact.whatsappPhone}</TableCell>
                <TableCell className="py-3">
                  <Badge className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                    contact.status === 'NEW'
                      ? 'bg-whatsapp/10 text-whatsapp border border-whatsapp/20'
                      : 'bg-indigo-950 text-indigo-300 border border-indigo-500/20'
                  }`}>
                    {contact.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-300 py-3">{contact.leadScore}</TableCell>
                <TableCell className="text-gray-400 py-3">{contact.lastMessageAt ? new Date(contact.lastMessageAt).toLocaleDateString() : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
