"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import {
  Users, MessageSquare, CalendarCheck2, Bot, UserCheck,
  FileText, TrendingUp, TrendingDown, BarChart2,
} from "lucide-react";

interface ReportsData {
  totalContacts: number;
  newContacts: number;
  totalConversations: number;
  openConversations: number;
  closedConversations: number;
  humanInterventions: number;
  aiHandled: number;
  appointmentsScheduled: number;
  appointmentsCancelled: number;
  templatesSent: number;
  leadsByStatus: { status: string; count: number }[];
  contactsPerDay: { date: string; count: number }[];
  conversationsPerDay: { date: string; count: number }[];
  topLeadSources: { source: string; count: number }[];
}

const PERIOD_OPTIONS = [
  { label: "7 días", value: "7d" },
  { label: "30 días", value: "30d" },
  { label: "90 días", value: "90d" },
];

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  QUALIFIED: "Calificado",
  INTERESTED: "Interesado",
  APPOINTMENT_SCHEDULED: "Cita",
  PROPOSAL_SENT: "Propuesta",
  WON: "Ganado",
  LOST: "Perdido",
};

const CHART_COLORS = ["#25D366", "#6366f1", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#14b8a6"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-[#ffffff15] rounded-md px-3 py-2 text-xs shadow-xl">
        <p className="text-gray-400 mb-1">{label}</p>
        {payload.map((p: { name: string; value: number; color: string }, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function StatCard({ icon, label, value, sub, accent = "#25D366" }: StatCardProps) {
  return (
    <div className="bg-[#111111] border border-[#ffffff0d] rounded-md p-4 flex flex-col gap-3 hover:border-[#ffffff20] transition-all duration-150">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{label}</span>
        <span style={{ color: accent }} className="opacity-80">{icon}</span>
      </div>
      <div>
        <span className="text-2xl font-extrabold text-white tracking-tight">{value}</span>
        {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session?.user as any)?.workspaceId;
  const [period, setPeriod] = useState("30d");

  const { data, isLoading } = useQuery<ReportsData>({
    queryKey: ["reports", workspaceId, period],
    queryFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      const res = await fetch(`/api/reports?workspaceId=${workspaceId}&period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  const totalHandled = (data?.aiHandled || 0) + (data?.humanInterventions || 0);
  const aiPct = totalHandled > 0 ? Math.round(((data?.aiHandled || 0) / totalHandled) * 100) : 0;
  const humanPct = totalHandled > 0 ? Math.round(((data?.humanInterventions || 0) / totalHandled) * 100) : 0;

  // Format date ticks nicely (show MM/DD)
  const formatDateTick = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="p-6 h-full w-full overflow-y-auto scrollbar-thin bg-[#0a0a0a] text-white font-sans antialiased">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 max-w-7xl">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-6 w-6 text-whatsapp" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">Reportes</h1>
            <p className="text-gray-500 text-xs mt-1.5">Métricas del workspace para el período seleccionado.</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-[#111111] border border-[#ffffff10] rounded-md p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              id={`period-${opt.value}`}
              onClick={() => setPeriod(opt.value)}
              className={`h-7 px-4 rounded-sm text-xs font-semibold transition-all duration-150 ${
                period === opt.value
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse text-sm">
          Cargando métricas...
        </div>
      ) : (
        <div className="max-w-7xl space-y-6">

          {/* ROW 1: Primary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Total Contactos"
              value={data?.totalContacts ?? 0}
              sub="acumulado total"
              accent="#25D366"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Nuevos Contactos"
              value={data?.newContacts ?? 0}
              sub={`en los últimos ${period === "7d" ? "7" : period === "30d" ? "30" : "90"} días`}
              accent="#6366f1"
            />
            <StatCard
              icon={<MessageSquare className="h-4 w-4" />}
              label="Conversaciones"
              value={data?.totalConversations ?? 0}
              sub={`${data?.openConversations ?? 0} abiertas actualmente`}
              accent="#f59e0b"
            />
            <StatCard
              icon={<CalendarCheck2 className="h-4 w-4" />}
              label="Citas Agendadas"
              value={data?.appointmentsScheduled ?? 0}
              sub={`${data?.appointmentsCancelled ?? 0} canceladas`}
              accent="#25D366"
            />
          </div>

          {/* ROW 2: AI / Human / Templates */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard
              icon={<Bot className="h-4 w-4" />}
              label="IA Atendido"
              value={`${aiPct}%`}
              sub={`${data?.aiHandled ?? 0} conversaciones con IA`}
              accent="#6366f1"
            />
            <StatCard
              icon={<UserCheck className="h-4 w-4" />}
              label="Intervención Humana"
              value={`${humanPct}%`}
              sub={`${data?.humanInterventions ?? 0} escalaciones manuales`}
              accent="#f59e0b"
            />
            <StatCard
              icon={<FileText className="h-4 w-4" />}
              label="Plantillas Enviadas"
              value={data?.templatesSent ?? 0}
              sub="mensajes template despachados"
              accent="#25D366"
            />
          </div>

          {/* ROW 3: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Line chart: Contacts per day */}
            <div className="bg-[#111111] border border-[#ffffff0d] rounded-md p-5">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="h-4 w-4 text-whatsapp" />
                <span className="text-sm font-semibold text-white">Contactos por Día</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data?.contactsPerDay || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateTick}
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={{ stroke: "#ffffff0d" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Contactos"
                    stroke="#25D366"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#25D366" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart: Conversations per day */}
            <div className="bg-[#111111] border border-[#ffffff0d] rounded-md p-5">
              <div className="flex items-center gap-2 mb-5">
                <MessageSquare className="h-4 w-4 text-indigoAccent" />
                <span className="text-sm font-semibold text-white">Conversaciones por Día</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.conversationsPerDay || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateTick}
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={{ stroke: "#ffffff0d" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Conversaciones" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROW 4: Leads by status + Top sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut: Leads by status */}
            <div className="bg-[#111111] border border-[#ffffff0d] rounded-md p-5">
              <div className="flex items-center gap-2 mb-5">
                <Users className="h-4 w-4 text-whatsapp" />
                <span className="text-sm font-semibold text-white">Leads por Estado</span>
              </div>
              {!data?.leadsByStatus?.length ? (
                <div className="flex items-center justify-center h-48 text-gray-600 text-xs italic">
                  Sin datos de leads disponibles.
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie
                        data={data.leadsByStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {data.leadsByStatus.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {data.leadsByStatus.map((item, i) => (
                      <div key={item.status} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="text-gray-400">{LEAD_STATUS_LABELS[item.status] || item.status}</span>
                        </div>
                        <span className="font-bold text-white">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Horizontal bar: Top lead sources */}
            <div className="bg-[#111111] border border-[#ffffff0d] rounded-md p-5">
              <div className="flex items-center gap-2 mb-5">
                <TrendingDown className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">Top Fuentes de Leads</span>
              </div>
              {!data?.topLeadSources?.length ? (
                <div className="flex items-center justify-center h-48 text-gray-600 text-xs italic">
                  Sin fuentes de leads registradas.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    layout="vertical"
                    data={data.topLeadSources}
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="source"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Leads" radius={[0, 3, 3, 0]} maxBarSize={20}>
                      {(data.topLeadSources || []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
