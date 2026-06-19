"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserPlus, Loader2, Shield, Eye, Settings, User, Copy } from "lucide-react";
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
    className: "bg-gray-900 text-slate-500 dark:text-gray-400 border-gray-700/40",
    icon: <Eye className="h-3 w-3" />,
  },
};

export default function MembersSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Invite Dialog State
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("AGENT");
  const [inviting, setInviting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const fetchMembers = () => {
    setLoading(true);
    fetch("/api/settings/members")
      .then((r) => r.json())
      .then((data) => setMembers(data))
      .catch(() => toast.error("Error al cargar los miembros"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast.error("Ingresa un correo electrónico válido");
      return;
    }
    
    setInviting(true);
    try {
      const res = await fetch("/api/settings/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      
      const data = await res.json();
      
      if (res.status === 409) {
          throw new Error("El usuario ya es miembro de este workspace");
      }
      
      if (!res.ok) {
          throw new Error(data.error || "Error al invitar al miembro");
      }
      
      toast.success("Miembro invitado correctamente");
      if (data.tempPassword) {
         setTempPassword(data.tempPassword);
      } else {
          // If no temp password, it means user already existed in the system, just close.
          setInviteOpen(false);
          setInviteEmail("");
      }
      fetchMembers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setInviting(false);
    }
  };
  
  const handleCopyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      toast.success("Contraseña copiada al portapapeles");
    }
  };

  const handleCloseInvite = () => {
      setInviteOpen(false);
      setTempPassword(null);
      setInviteEmail("");
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-whatsapp" />
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Miembros del Workspace</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {loading ? "Cargando..." : `${members.length} miembro${members.length !== 1 ? "s" : ""} en este workspace`}
            </p>
          </div>
        </div>

        <Button
          id="btn-invite-member"
          onClick={() => setInviteOpen(true)}
          className="bg-white dark:bg-[#111111] hover:bg-slate-50 dark:bg-white/5 border border-[var(--border-color)] text-slate-900 dark:text-white font-semibold h-8 text-xs px-3 rounded-md flex items-center gap-2"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invitar miembro
        </Button>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-[#111111] border border-[#ffffff0d] rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-[#0a0a0a]">
            <TableRow className="hover:bg-slate-50 dark:bg-[#0a0a0a] border-b border-[#ffffff10]">
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
                        <Avatar className="h-7 w-7 border border-[var(--border-color)] shrink-0">
                          <AvatarFallback className="bg-white dark:bg-[#1a1a1a] text-slate-600 dark:text-gray-300 text-[10px] font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {member.user.name ?? "—"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="py-3 text-slate-500 dark:text-gray-400 text-xs font-mono">
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
      <div className="bg-white dark:bg-[#111111] border border-[#ffffff08] rounded-md p-4">
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
      
      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => !open && handleCloseInvite()}>
        <DialogContent className="bg-white dark:bg-[#111111] border border-[var(--border-color)] text-slate-900 dark:text-white rounded-md max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Invitar Miembro</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {!tempPassword ? (
                <>
                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="inviteEmail">
                        Correo Electrónico
                    </Label>
                    <Input
                        id="inviteEmail"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="usuario@empresa.com"
                        className="bg-white dark:bg-[#1a1a1a] border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 focus-visible:ring-whatsapp"
                    />
                </div>
                
                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-gray-400 font-medium" htmlFor="inviteRole">
                        Rol
                    </Label>
                    <select
                        id="inviteRole"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="w-full bg-white dark:bg-[#1a1a1a] border border-[var(--border-color)] text-slate-900 dark:text-white text-sm h-9 rounded-md px-3 focus:ring-1 focus:ring-whatsapp focus:border-whatsapp outline-none"
                    >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="AGENT">Agent</option>
                        <option value="VIEWER">Viewer</option>
                    </select>
                </div>
                </>
            ) : (
                <div className="space-y-3 bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90/10 border border-whatsapp/20 p-4 rounded-md">
                    <p className="text-xs text-whatsapp font-medium text-center">
                        ¡Usuario creado e invitado exitosamente!
                    </p>
                    <p className="text-xs text-slate-600 dark:text-gray-300 text-center">
                        Comparte esta contraseña temporal con el usuario para que pueda iniciar sesión:
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <Input 
                           value={tempPassword} 
                           readOnly 
                           className="bg-slate-50 dark:bg-[#0a0a0a] border-whatsapp/30 text-slate-900 dark:text-white font-mono h-9 focus-visible:ring-0 text-center"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCopyPassword}
                            className="h-9 w-9 bg-slate-50 dark:bg-[#0a0a0a] border-whatsapp/30 text-whatsapp hover:text-slate-900 dark:text-white hover:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90 shrink-0 transition-colors"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
          </div>
          
          <DialogFooter className="mt-2">
            {!tempPassword ? (
                <>
                <Button variant="outline" onClick={handleCloseInvite} className="bg-transparent border-[var(--border-color)] text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 h-8 text-xs">
                    Cancelar
                </Button>
                <Button 
                    onClick={handleInvite} 
                    disabled={inviting || !inviteEmail.trim()} 
                    className="bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90 hover:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90Hover text-black font-semibold h-8 text-xs px-4"
                >
                    {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    {inviting ? "Invitando..." : "Invitar"}
                </Button>
                </>
            ) : (
                <Button onClick={handleCloseInvite} className="bg-white hover:bg-gray-200 text-black font-semibold h-8 text-xs w-full">
                    Aceptar
                </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
