"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Clock } from "lucide-react";

interface RuleState {
  dayOfWeek: number;
  name: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

const DAYS_OF_WEEK = [
  { day: 1, name: "Lunes" },
  { day: 2, name: "Martes" },
  { day: 3, name: "Miércoles" },
  { day: 4, name: "Jueves" },
  { day: 5, name: "Viernes" },
  { day: 6, name: "Sábado" },
  { day: 0, name: "Domingo" },
];

export default function AvailabilitySettingsPage() {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId;

  const [rules, setRules] = useState<RuleState[]>(
    DAYS_OF_WEEK.map((d) => ({
      dayOfWeek: d.day,
      name: d.name,
      isActive: false,
      startTime: "09:00",
      endTime: "18:00",
    }))
  );

  const [duration, setDuration] = useState<number>(30);
  const [buffer, setBuffer] = useState<number>(0);

  // Fetch current rules
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ["availability-rules", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await fetch(`/api/availability/rules?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!workspaceId,
  });

  // Sync state
  useEffect(() => {
    if (rulesData) {
      setDuration(rulesData.duration || 30);
      setBuffer(rulesData.buffer || 0);

      const dbRules = rulesData.rules || [];
      setRules((prev) =>
        prev.map((item) => {
          const matched = dbRules.find((r: { dayOfWeek: number }) => r.dayOfWeek === item.dayOfWeek);
          if (matched) {
            return {
              ...item,
              isActive: true,
              startTime: matched.startTime,
              endTime: matched.endTime,
            };
          }
          return { ...item, isActive: false };
        })
      );
    }
  }, [rulesData]);

  // Save rules mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/availability/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          rules,
          duration,
          buffer,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Reglas de disponibilidad actualizadas");
    },
    onError: () => {
      toast.error("Error al guardar las reglas");
    },
  });

  const toggleDay = (day: number) => {
    setRules((prev) =>
      prev.map((r) => (r.dayOfWeek === day ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const updateTime = (day: number, field: "startTime" | "endTime", value: string) => {
    setRules((prev) =>
      prev.map((r) => (r.dayOfWeek === day ? { ...r, [field]: value } : r))
    );
  };

  const handleSave = () => {
    if (!workspaceId) return;
    saveMutation.mutate();
  };

  return (
    <div className="p-8 w-full h-full flex flex-col bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-white overflow-y-auto scrollbar-thin font-sans antialiased">
      <div className="flex justify-between items-center mb-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Disponibilidad</h1>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Configura tus horarios de atención para agendamiento de citas.</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || isLoading}
          className="bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90 hover:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90Hover text-black font-semibold rounded-md flex items-center gap-2 h-9 px-4 transition-all duration-150"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-500 animate-pulse">Cargando disponibilidad...</div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {/* General Config Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-[#111111] border border-[#ffffff10] rounded-md space-y-3">
              <div className="flex items-center gap-2 text-whatsapp">
                <Clock className="h-4 w-4" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Duración de la Cita</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400">Duración promedio de cada sesión o cita de negocios.</p>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#ffffff15] text-slate-900 dark:text-white rounded-md text-sm p-2 focus:ring-1 focus:ring-whatsapp focus:border-whatsapp outline-none"
              >
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos</option>
                <option value={90}>90 minutos</option>
              </select>
            </div>

            <div className="p-4 bg-white dark:bg-[#111111] border border-[#ffffff10] rounded-md space-y-3">
              <div className="flex items-center gap-2 text-indigoAccent">
                <Clock className="h-4 w-4" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Buffer de Descanso</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400">Tiempo libre agregado entre citas programadas consecutivas.</p>
              <select
                value={buffer}
                onChange={(e) => setBuffer(parseInt(e.target.value))}
                className="w-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#ffffff15] text-slate-900 dark:text-white rounded-md text-sm p-2 focus:ring-1 focus:ring-whatsapp focus:border-whatsapp outline-none"
              >
                <option value={0}>Sin buffer</option>
                <option value={10}>10 minutos</option>
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
              </select>
            </div>
          </div>

          {/* 7-day Grid */}
          <div className="bg-white dark:bg-[#111111] border border-[#ffffff10] rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[#ffffff10] bg-[#0d0d0d]">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Horarios Semanales</h3>
            </div>
            <div className="divide-y divide-[#ffffff08] p-2">
              {rules.map((rule) => (
                <div key={rule.dayOfWeek} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-4">
                  <div className="flex items-center gap-4 min-w-[150px]">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => toggleDay(rule.dayOfWeek)}
                      className="data-[state=checked]:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-whatsapp/90"
                    />
                    <span className={`text-sm font-semibold ${rule.isActive ? "text-slate-900 dark:text-white" : "text-gray-500"}`}>
                      {rule.name}
                    </span>
                  </div>

                  {rule.isActive ? (
                    <div className="flex items-center gap-3">
                      <div className="space-y-1">
                        <Input
                          type="time"
                          value={rule.startTime}
                          onChange={(e) => updateTime(rule.dayOfWeek, "startTime", e.target.value)}
                          className="bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-[#ffffff15] text-slate-900 dark:text-white text-xs h-9 w-28 rounded-md focus-visible:ring-whatsapp"
                        />
                      </div>
                      <span className="text-gray-500 text-xs">a</span>
                      <div className="space-y-1">
                        <Input
                          type="time"
                          value={rule.endTime}
                          onChange={(e) => updateTime(rule.dayOfWeek, "endTime", e.target.value)}
                          className="bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-[#ffffff15] text-slate-900 dark:text-white text-xs h-9 w-28 rounded-md focus-visible:ring-whatsapp"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-xs italic py-2">
                      No disponible
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
