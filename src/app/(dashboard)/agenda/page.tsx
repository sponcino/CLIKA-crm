"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, 
  Clock, User as UserIcon, Trash2, CheckCircle2 
} from "lucide-react";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Contact {
  id: string;
  whatsappName: string;
  fullName: string;
  whatsappPhone: string;
}

interface Appointment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  notes?: string;
  rescheduledCount: number;
  contact: {
    id: string;
    whatsappName?: string;
    fullName?: string;
    whatsappPhone: string;
  };
}

export default function AgendaPage() {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId;
  const queryClient = useQueryClient();

  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Modals
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  
  // New Appointment Form State
  const [searchContact, setSearchContact] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newNotes, setNewNotes] = useState("");

  // Fetch Appointments
  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments", workspaceId, currentDate, view],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`/api/appointments?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!workspaceId,
  });

  // Fetch Contacts for autocomplete search
  const { data: contactsData } = useQuery<{ data: Contact[] }>({
    queryKey: ["contacts-autocomplete", workspaceId, searchContact],
    queryFn: async () => {
      if (!workspaceId) return { data: [] };
      const res = await fetch(`/api/contacts?workspaceId=${workspaceId}&search=${searchContact}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!workspaceId,
  });

  // Mutate: Create Appointment
  const createMutation = useMutation({
    mutationFn: async () => {
      const startDateTime = new Date(`${newDate}T${newStartTime}`);
      const endDateTime = new Date(`${newDate}T${newEndTime}`);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          contactId: selectedContact?.id,
          title: newTitle,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          notes: newNotes,
        }),
      });
      if (res.status === 409) {
        throw new Error("Conflict: overlapping appointments");
      }
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Cita programada con éxito");
      setIsNewDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: Error) => {
      if (err.message.includes("Conflict")) {
        toast.error("Conflicto: Este horario se superpone con otra cita.");
      } else {
        toast.error("Error al programar la cita");
      }
    },
  });

  // Mutate: Cancel Appointment
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Cita cancelada correctamente");
      setActiveAppointment(null);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  // Mutate: Complete Appointment
  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Cita marcada como completada");
      setActiveAppointment(null);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const resetForm = () => {
    setNewTitle("");
    setSearchContact("");
    setSelectedContact(null);
    setNewStartTime("09:00");
    setNewEndTime("10:00");
    setNewNotes("");
  };

  const handleNext = () => {
    if (view === "day") setCurrentDate(addDays(currentDate, 1));
    else if (view === "week") setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 30));
  };

  const handlePrev = () => {
    if (view === "day") setCurrentDate(addDays(currentDate, -1));
    else if (view === "week") setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -30));
  };

  // Filter appointments for current visual grid range
  const getVisibleAppointments = () => {
    return appointments.filter((app) => {
      const appDate = parseISO(app.startTime);
      if (view === "day") {
        return isSameDay(appDate, currentDate);
      } else if (view === "week") {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = addDays(start, 6);
        return appDate >= start && appDate <= end;
      } else {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        return appDate >= start && appDate <= end;
      }
    });
  };

  const getStatusColor = (status: string, rescheduledCount: number) => {
    if (status === "CANCELED" || status === "CANCELED") return "bg-red-950/40 text-red-400 border-red-500/20";
    if (status === "COMPLETED") return "bg-green-950/40 text-green-400 border-green-500/20";
    if (rescheduledCount > 0) return "bg-amber-950/40 text-amber-400 border-amber-500/20";
    return "bg-indigo-950/40 text-indigo-400 border-indigo-500/20";
  };

  const upcomingAppointments = appointments
    .filter((a) => new Date(a.startTime).getTime() >= new Date().getTime() && a.status !== "CANCELED")
    .slice(0, 5);

  const visibleAppointments = getVisibleAppointments();

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-[#0a0a0a] text-gray-200">
      {/* MAIN CALENDAR PANEL */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-[#0a0a0a] p-6 border-r border-[#ffffff10] overflow-y-auto scrollbar-thin">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-6 w-6 text-whatsapp" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Agenda</h1>
            
            <div className="flex items-center gap-1.5 ml-4 bg-white dark:bg-[#111111] p-1 border border-[#ffffff10] rounded-md">
              <Button 
                onClick={() => setView("day")} 
                className={`h-7 text-xs px-3 rounded-sm border-0 font-medium ${view === "day" ? "bg-white/10 text-slate-900 dark:text-white" : "bg-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white"}`}
              >
                Día
              </Button>
              <Button 
                onClick={() => setView("week")} 
                className={`h-7 text-xs px-3 rounded-sm border-0 font-medium ${view === "week" ? "bg-white/10 text-slate-900 dark:text-white" : "bg-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white"}`}
              >
                Semana
              </Button>
              <Button 
                onClick={() => setView("month")} 
                className={`h-7 text-xs px-3 rounded-sm border-0 font-medium ${view === "month" ? "bg-white/10 text-slate-900 dark:text-white" : "bg-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white"}`}
              >
                Mes
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white dark:bg-[#111111] border border-[#ffffff10] rounded-md px-1.5 py-0.5">
              <Button onClick={handlePrev} variant="ghost" className="h-7 w-7 p-0 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-semibold px-2 text-slate-900 dark:text-white">
                {view === "day" && format(currentDate, "EEEE, d 'de' MMMM", { locale: es })}
                {view === "week" && `Semana ${format(currentDate, "w, yyyy")}`}
                {view === "month" && format(currentDate, "MMMM 'de' yyyy", { locale: es })}
              </span>
              <Button onClick={handleNext} variant="ghost" className="h-7 w-7 p-0 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button 
              onClick={() => setIsNewDialogOpen(true)}
              className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold h-8 text-xs rounded-md flex items-center gap-1.5 px-3 transition-all duration-150"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva cita
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-gray-500 animate-pulse">Cargando agenda...</div>
        ) : (
          <div className="flex-1 space-y-4">
            {/* GRID CALENDAR */}
            {view === "week" && (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => {
                  const dayDate = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i);
                  const dayAppointments = visibleAppointments.filter((a) => isSameDay(parseISO(a.startTime), dayDate));
                  return (
                    <div key={i} className="min-h-[250px] bg-white dark:bg-[#111111] border border-[#ffffff10] rounded-md p-2 flex flex-col">
                      <div className="text-center pb-2 border-b border-[#ffffff08] mb-2">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                          {format(dayDate, "eee", { locale: es })}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white block">
                          {format(dayDate, "d")}
                        </span>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="space-y-1.5">
                          {dayAppointments.length === 0 ? (
                            <span className="text-[10px] text-gray-600 block text-center mt-6">Sin citas</span>
                          ) : (
                            dayAppointments.map((app) => (
                              <div
                                key={app.id}
                                onClick={() => setActiveAppointment(app)}
                                className={`p-2 rounded-sm border cursor-pointer text-left transition-all duration-150 ${getStatusColor(app.status, app.rescheduledCount)}`}
                              >
                                <span className="font-semibold text-xs block truncate leading-none mb-1">{app.title}</span>
                                <span className="text-[9px] opacity-70 block font-medium">
                                  {format(parseISO(app.startTime), "HH:mm")}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  );
                })}
              </div>
            )}

            {view === "day" && (
              <div className="bg-white dark:bg-[#111111] border border-[#ffffff10] rounded-md p-4 space-y-2">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-2">Citas para el día</h3>
                {visibleAppointments.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 italic text-xs">No hay citas agendadas para hoy.</div>
                ) : (
                  <div className="space-y-2">
                    {visibleAppointments.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => setActiveAppointment(app)}
                        className={`p-3 rounded-md border cursor-pointer transition-all duration-150 flex items-center justify-between ${getStatusColor(app.status, app.rescheduledCount)}`}
                      >
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white leading-none">{app.title}</h4>
                          <p className="text-xs opacity-75">{app.contact.whatsappName || app.contact.fullName || app.contact.whatsappPhone}</p>
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-medium block">{format(parseISO(app.startTime), "HH:mm")} - {format(parseISO(app.endTime), "HH:mm")}</span>
                          <span className="text-[10px] opacity-60 block mt-0.5">{app.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === "month" && (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 30 }).map((_, i) => {
                  const dayDate = addDays(startOfMonth(currentDate), i);
                  const dayAppointments = visibleAppointments.filter((a) => isSameDay(parseISO(a.startTime), dayDate));
                  return (
                    <div key={i} className="min-h-[80px] bg-white dark:bg-[#111111] border border-[#ffffff10] rounded-md p-2 flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-500 dark:text-gray-400 block mb-1">
                        {format(dayDate, "d")}
                      </span>
                      <div className="flex-1 overflow-hidden space-y-1">
                        {dayAppointments.slice(0, 2).map((app) => (
                          <div
                            key={app.id}
                            onClick={() => setActiveAppointment(app)}
                            className={`p-1 text-[9px] rounded-sm truncate leading-none cursor-pointer border ${getStatusColor(app.status, app.rescheduledCount)}`}
                          >
                            {app.title}
                          </div>
                        ))}
                        {dayAppointments.length > 2 && (
                          <span className="text-[8px] text-gray-500 block">+{dayAppointments.length - 2} más</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* UPCOMING SIDEBAR PANEL (Width 220px) */}
      <div className="w-[240px] bg-[#0c0c0c] flex flex-col shrink-0 p-4 space-y-6 overflow-y-auto scrollbar-thin">
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Próximas Citas</h3>
          
          <div className="space-y-3">
            {upcomingAppointments.length === 0 ? (
              <div className="p-3 bg-white dark:bg-[#111111] border border-[#ffffff05] rounded-md text-xs text-gray-500 text-center italic">
                Sin citas futuras.
              </div>
            ) : (
              upcomingAppointments.map((app) => (
                <div 
                  key={app.id} 
                  onClick={() => setActiveAppointment(app)}
                  className="p-3 bg-white dark:bg-[#111111] border border-[#ffffff08] rounded-md hover:bg-slate-50 dark:bg-white/5 cursor-pointer transition-all duration-150 text-left space-y-1.5"
                >
                  <h4 className="font-semibold text-xs text-slate-900 dark:text-white truncate leading-none">{app.title}</h4>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{app.contact.whatsappName || app.contact.whatsappPhone}</p>
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{format(parseISO(app.startTime), "d MMM, HH:mm", { locale: es })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Nueva Cita */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="bg-white dark:bg-[#111111] border border-[#ffffff10] text-slate-900 dark:text-white rounded-md max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Nueva Cita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Contacto</Label>
              <Input
                placeholder="Buscar por nombre o teléfono..."
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                className="bg-white dark:bg-[#111111] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-whatsapp"
              />
              
              {/* Autocomplete List */}
              {searchContact.trim() !== "" && contactsData?.data && (
                <div className="bg-white dark:bg-[#111111] border border-[#ffffff10] rounded-md max-h-32 overflow-y-auto scrollbar-thin text-xs divide-y divide-[#ffffff05]">
                  {contactsData.data.slice(0, 5).map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => {
                        setSelectedContact(contact);
                        setSearchContact("");
                      }}
                      className="p-2 hover:bg-slate-50 dark:bg-white/5 cursor-pointer transition-colors"
                    >
                      {contact.whatsappName || contact.fullName} ({contact.whatsappPhone})
                    </div>
                  ))}
                </div>
              )}

              {selectedContact && (
                <div className="mt-2 p-2 bg-whatsapp/10 border border-whatsapp/20 rounded-md flex items-center justify-between text-xs text-whatsapp">
                  <span>Seleccionado: <b>{selectedContact.whatsappName || selectedContact.fullName}</b></span>
                  <Button variant="ghost" className="h-5 px-1 hover:text-slate-900 dark:text-white" onClick={() => setSelectedContact(null)}>Remover</Button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Asunto / Título</Label>
              <Input
                placeholder="Ej. Demostración de producto"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-white dark:bg-[#111111] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-whatsapp"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Fecha</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-white dark:bg-[#111111] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-whatsapp"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Hora Inicio</Label>
                <Input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="bg-white dark:bg-[#111111] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-whatsapp"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Hora Fin</Label>
                <Input
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  className="bg-white dark:bg-[#111111] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-whatsapp"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Notas</Label>
              <textarea
                placeholder="Detalles sobre la cita..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full bg-white dark:bg-[#111111] border border-[#ffffff15] text-slate-900 dark:text-white rounded-md text-sm p-2 focus:ring-1 focus:ring-whatsapp focus:border-whatsapp outline-none min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)} className="bg-transparent border-[#ffffff15] text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:bg-white/5 hover:text-slate-900 dark:text-white rounded-md h-8 text-xs">
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate()} 
              disabled={createMutation.isPending || !selectedContact || !newTitle.trim()} 
              className="bg-whatsapp hover:bg-whatsappHover text-black font-semibold rounded-md h-8 text-xs px-4"
            >
              {createMutation.isPending ? "Agendando..." : "Agendar Cita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SHEET: Detalles de Cita */}
      <Sheet open={activeAppointment !== null} onOpenChange={(open) => !open && setActiveAppointment(null)}>
        <SheetContent className="bg-white dark:bg-[#111111] border-l border-[#ffffff10] text-slate-900 dark:text-white max-w-sm">
          {activeAppointment && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">Detalles de la Cita</SheetTitle>
              </SheetHeader>

              <div className="space-y-4">
                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Asunto</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white block">{activeAppointment.title}</span>
                </div>

                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Contacto</span>
                  <div className="flex items-center gap-2 mt-1">
                    <UserIcon className="h-4 w-4 text-whatsapp" />
                    <div>
                      <span className="text-xs font-semibold block text-slate-900 dark:text-white">
                        {activeAppointment.contact.whatsappName || activeAppointment.contact.fullName || "Desconocido"}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 block">{activeAppointment.contact.whatsappPhone}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Horario</span>
                  <div className="flex items-center gap-2 mt-1 text-xs font-medium text-slate-600 dark:text-gray-300">
                    <Clock className="h-4 w-4 text-indigoAccent" />
                    <span>
                      {format(parseISO(activeAppointment.startTime), "EEEE, d 'de' MMMM", { locale: es })}
                      <br />
                      {format(parseISO(activeAppointment.startTime), "HH:mm")} a {format(parseISO(activeAppointment.endTime), "HH:mm")}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Estado</span>
                  <div className="inline-flex mt-1">
                    <Badge className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                      getStatusColor(activeAppointment.status, activeAppointment.rescheduledCount)
                    }`}>
                      {activeAppointment.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Notas</span>
                  <div className="p-3 bg-white dark:bg-[#111111] rounded-md text-xs text-slate-600 dark:text-gray-300 border border-[#ffffff08] mt-1">
                    {activeAppointment.notes || <i className="text-gray-500">Sin notas adicionales.</i>}
                  </div>
                </div>
              </div>

              {activeAppointment.status === "SCHEDULED" && (
                <div className="pt-6 border-t border-[#ffffff08] flex gap-2">
                  <Button 
                    onClick={() => completeMutation.mutate(activeAppointment.id)} 
                    disabled={completeMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-slate-900 dark:text-white font-semibold rounded-md h-8 text-xs flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completar
                  </Button>
                  <Button 
                    onClick={() => cancelMutation.mutate(activeAppointment.id)} 
                    disabled={cancelMutation.isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-slate-900 dark:text-white font-semibold rounded-md h-8 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
