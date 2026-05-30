"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Loader2, Shield, Eye, Settings, User } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Member {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER";
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

const ROLE_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  OWNER: {
    label: "Owner",
    className: "bg-amber-950/50 text-amber-400 border-amber-700/40",
    icon: <Shield className="h-3 w-3" />,
  },
  ADMIN: {
    label: "Admin",
    className: "bg-indigo-950/50 text-indigo-400 border-indigo-700/40",
    icon: <Settings className="h-3 w-3" />,
  },
  MANAGER: {
    label: "Manager",
    className: "bg-blue-950/50 text-blue-400 border-blue-700/40",
    icon: <User className="h-3 w-3" />,
  },
  AGENT: {
    label: "Agent",
    className: "bg-green-950/50 text-green-400 border-green-700/40",
    icon: <User className="h-3 w-3" />,
  },
  VIEWER: {
    label: "Viewer",
    className: "bg-gray-900 text-gray-400 border-gray-700/40",
    icon: <Eye className="h-3 w-3" />,
  },
};

export default function MembersSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/members")
      .then((r) => r.json())
      .then((data) => setMembers(data))
      .catch(() => toast.error("Error al cargar los miembros"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-whatsapp" />
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Miembros del Workspace</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {loading ? "Cargando..." : `${members.length} miembro${members.length !== 1 ? "s" : ""} en este workspace`}
            </p>
          </div>
        </div>

        <Button
          id="btn-invite-member"
          onClick={() => toast.info("Invitación de miembros próximamente disponible.")}
          className="bg-[#111111] hover:bg-white/5 border border-white/10 text-white font-semibold h-8 text-xs px-3 rounded-md flex items-center gap-2"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invitar miembro
        </Button>
      </div>

      {/* Members Table */}
      <div className="bg-[#111111] border border-[#ffffff0d] rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-[#0a0a0a]">
            <TableRow className="hover:bg-[#0a0a0a] border-b border-[#ffffff10]">
              <TableHead className="text-gray-500 font-semibold h-10 text-xs">Miembro</TableHead>
              <TableHead className="text-gray-500 font-semibold h-10 text-xs">Email</TableHead>
              <TableHead className="text-gray-500 font-semibold h-10 text-xs">Rol</TableHead>
              <TableHead className="text-gray-500 font-semibold h-10 text-xs">Ingresó</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-b border-[#ffffff05]">
                <TableCell colSpan={4} className="text-center h-24 text-gray-600 animate-pulse">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Cargando miembros...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow className="border-b border-[#ffffff05]">
                <TableCell colSpan={4} className="text-center h-24 text-gray-600 text-sm italic">
                  No se encontraron miembros en este workspace.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const roleCfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG["VIEWER"];
                const initials = (member.user.name ?? member.user.email)
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <TableRow
                    key={member.id}
                    className="border-b border-[#ffffff05] hover:bg-[#ffffff04] transition-colors"
                  >
                    {/* Name + Avatar */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7 border border-white/10 shrink-0">
                          <AvatarFallback className="bg-[#1a1a1a] text-gray-300 text-[10px] font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-white">
                          {member.user.name ?? "—"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="py-3 text-gray-400 text-xs font-mono">
                      {member.user.email}
                    </TableCell>

                    {/* Role Badge */}
                    <TableCell className="py-3">
                      <Badge
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border flex items-center gap-1.5 w-fit ${roleCfg.className}`}
                      >
                        {roleCfg.icon}
                        {roleCfg.label}
                      </Badge>
                    </TableCell>

                    {/* Joined date */}
                    <TableCell className="py-3 text-gray-500 text-xs">
                      {formatDistanceToNow(parseISO(member.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Role legend */}
      <div className="bg-[#111111] border border-[#ffffff08] rounded-md p-4">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
          Roles disponibles
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2.5">
              <Badge className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border flex items-center gap-1 w-fit ${cfg.className}`}>
                {cfg.icon}
                {cfg.label}
              </Badge>
              <span className="text-[10px] text-gray-600">
                {key === "OWNER" && "Control total del workspace"}
                {key === "ADMIN" && "Configuración y gestión"}
                {key === "MANAGER" && "Gestión de contactos y conv."}
                {key === "AGENT" && "Responde conversaciones"}
                {key === "VIEWER" && "Solo lectura"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
