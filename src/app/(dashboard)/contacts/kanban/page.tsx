"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';
import { LeadStatus } from '@prisma/client';
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const COLUMNS = [
  { id: "NEW", title: "Nuevo" },
  { id: "CONTACTED", title: "Contactado" },
  { id: "QUALIFIED", title: "Calificado" },
  { id: "INTERESTED", title: "Interesado" },
  { id: "APPOINTMENT_SCHEDULED", title: "Cita Agendada" },
  { id: "PROPOSAL_SENT", title: "Propuesta Enviada" },
  { id: "WON", title: "Ganado" },
  { id: "LOST", title: "Perdido" },
];

export default function KanbanPage() {
  const { data: session } = useSession()
  const workspaceId = (session?.user as any)?.workspaceId
  const queryClient = useQueryClient()

  const [items, setItems] = useState<Record<string, any[]>>({
    NEW: [], CONTACTED: [], QUALIFIED: [], INTERESTED: [],
    APPOINTMENT_SCHEDULED: [], PROPOSAL_SENT: [], WON: [], LOST: []
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const res = await fetch(`/api/contacts?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      return data.contacts || []
    },
    enabled: !!workspaceId
  });

  useEffect(() => {
    if (contacts) {
      const grouped = { ...items };
      // Clear current items
      Object.keys(grouped).forEach(k => grouped[k] = []);
      
      contacts.forEach((contact: any) => {
        if (grouped[contact.status]) {
          grouped[contact.status].push(contact);
        } else {
          grouped["NEW"].push(contact); // fallback
        }
      });
      setItems(grouped);
    }
  }, [contacts]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await fetch(`/api/contacts/${id}?workspaceId=${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', workspaceId] });
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id) || over.id;

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((i) => i.id === active.id);
      const overIndex = overItems.findIndex((i) => i.id === over.id);

      let newIndex;
      if (over.id in prev) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter((item) => item.id !== active.id),
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          activeItems[activeIndex],
          ...prev[overContainer].slice(newIndex, prev[overContainer].length),
        ],
      };
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over?.id) || over?.id;

    if (!activeContainer || !overContainer || activeContainer !== overContainer) {
      if (activeContainer && overContainer && COLUMNS.find(c => c.id === overContainer)) {
        // Dropped into a different column
        updateStatusMutation.mutate({ id: active.id, status: overContainer });
      }
    } else if (activeContainer === overContainer) {
      const activeIndex = items[activeContainer].findIndex((i) => i.id === active.id);
      const overIndex = items[overContainer].findIndex((i) => i.id === over?.id);

      if (activeIndex !== overIndex) {
        setItems((prev) => ({
          ...prev,
          [overContainer]: arrayMove(prev[overContainer], activeIndex, overIndex),
        }));
      }
    }
    setActiveId(null);
  };

  function findContainer(id: string) {
    if (id in items) return id;
    return Object.keys(items).find((key) => items[key].some((item) => item.id === id));
  }

  const renderContactCard = (contact: any) => (
    <div className="bg-white dark:bg-[#111111] p-3 rounded-md border border-[#ffffff10] shadow-sm mb-2 text-xs hover:border-[#ffffff20] transition-colors">
      <div className="font-semibold text-slate-900 dark:text-white mb-1 truncate">{contact.whatsappName || contact.fullName || "Sin nombre"}</div>
      <div className="text-slate-500 dark:text-gray-400 mb-2 font-mono">{contact.whatsappPhone}</div>
      <div className="flex items-center justify-between">
        <span className="text-whatsapp bg-whatsapp/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
          Score: {contact.leadScore}
        </span>
        <span className="text-[10px] text-gray-500">
          {contact.lastMessageAt ? formatDistanceToNow(new Date(contact.lastMessageAt), { locale: es, addSuffix: true }) : 'Sin msjs'}
        </span>
      </div>
    </div>
  );

  if (isLoading) return <div className="p-8 text-center text-slate-500 dark:text-gray-400">Cargando Kanban...</div>;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] bg-slate-50 dark:bg-[#0a0a0a] overflow-hidden">
      <div className="p-6 pb-4 border-b border-[#ffffff10] shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Kanban de Contactos</h1>
        <p className="text-gray-500 text-sm mt-1">Arrastra los contactos para cambiar su estado en el embudo de ventas.</p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 scrollbar-thin">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            {COLUMNS.map((column) => (
              <div key={column.id} className="w-[280px] shrink-0 flex flex-col bg-[#0f0f0f] border border-[#ffffff08] rounded-xl overflow-hidden">
                <div className="p-3 border-b border-[#ffffff08] bg-[#141414] font-semibold text-sm text-gray-200 flex justify-between items-center">
                  {column.title}
                  <span className="bg-[#222222] text-xs text-slate-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{items[column.id]?.length || 0}</span>
                </div>
                
                <div className="flex-1 p-2 overflow-y-auto scrollbar-none">
                  <SortableContext
                    id={column.id}
                    items={items[column.id]?.map((i) => i.id) || []}
                    strategy={verticalListSortingStrategy}
                  >
                    {items[column.id]?.map((contact) => (
                      <SortableItem key={contact.id} id={contact.id}>
                        {renderContactCard(contact)}
                      </SortableItem>
                    ))}
                  </SortableContext>
                </div>
              </div>
            ))}
          </div>

          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }),
            }}
          >
            {activeId ? (() => {
              const container = findContainer(activeId);
              const contact = container ? items[container].find((i) => i.id === activeId) : null;
              return contact ? (
                <div className="opacity-90 rotate-3 cursor-grabbing">
                  {renderContactCard(contact)}
                </div>
              ) : null;
            })() : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
