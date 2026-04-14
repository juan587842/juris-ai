"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";

import { KanbanColumn } from "@/components/crm/KanbanColumn";
import { LeadCard } from "@/components/crm/LeadCard";
import { api, ApiError } from "@/lib/api";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  LEAD_STATUS_ORDER,
  type Lead,
  type LeadStatus,
} from "@/types/crm";

export function KanbanBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Lead[]>("/api/crm/leads?limit=500");
        if (!cancelled) setLeads(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar leads");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("crm-leads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          setLeads((prev) => {
            if (payload.eventType === "INSERT") {
              const newLead = payload.new as Lead;
              if (prev.some((l) => l.id === newLead.id)) return prev;
              return [newLead, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const updated = payload.new as Lead;
              return prev.map((l) => (l.id === updated.id ? updated : l));
            }
            if (payload.eventType === "DELETE") {
              const oldLead = payload.old as { id: string };
              return prev.filter((l) => l.id !== oldLead.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const leadsByStatus = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = {
      novo: [],
      contato_feito: [],
      qualificado: [],
      desqualificado: [],
      convertido: [],
    };
    for (const lead of leads) {
      grouped[lead.status]?.push(lead);
    }
    return grouped;
  }, [leads]);

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id);
    if (lead) setActiveLead(lead);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;

    const newStatus = over.id as LeadStatus;
    if (!LEAD_STATUS_ORDER.includes(newStatus)) return;
    if (lead.status === newStatus) return;

    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: newStatus } : l))
    );

    try {
      await api.patch(`/api/crm/leads/${lead.id}`, { status: newStatus });
    } catch (err) {
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: lead.status } : l))
      );
      setError(
        err instanceof ApiError ? err.message : "Falha ao atualizar status"
      );
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Carregando leads...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="border-b bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full gap-4 overflow-x-auto p-6">
          {LEAD_STATUS_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={leadsByStatus[status]}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
