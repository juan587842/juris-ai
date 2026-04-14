"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import { LeadCard } from "@/components/crm/LeadCard";
import { LEAD_STATUS_LABELS, type Lead, type LeadStatus } from "@/types/crm";

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
}

export function KanbanColumn({ status, leads }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex h-full w-72 flex-shrink-0 flex-col rounded-lg bg-muted/40">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          {LEAD_STATUS_LABELS[status]}
        </h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-3 transition-colors ${
          isOver ? "bg-accent/50" : ""
        }`}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </SortableContext>
        {leads.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Nenhum lead
          </div>
        ) : null}
      </div>
    </div>
  );
}
