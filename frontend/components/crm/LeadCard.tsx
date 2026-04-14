"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

import { AREA_JURIDICA_LABELS, type Lead } from "@/types/crm";

interface LeadCardProps {
  lead: Lead;
}

export function LeadCard({ lead }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id, data: { lead } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-md border bg-card p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {lead.nome ?? "Sem nome"}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span className="truncate">{lead.telefone}</span>
          </div>
        </div>
        <Link
          href={`/crm/${lead.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Abrir lead"
        >
          <MessageCircle className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {lead.area_interesse ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {AREA_JURIDICA_LABELS[lead.area_interesse]}
          </span>
        ) : null}
        {lead.origem ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {lead.origem}
          </span>
        ) : null}
      </div>
    </div>
  );
}
