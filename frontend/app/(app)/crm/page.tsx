"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { NovoLeadModal } from "@/components/crm/NovoLeadModal";
import { UserPlus } from "lucide-react";
import type { Lead } from "@/types/crm";

export default function CrmPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* O KanbanBoard já escuta Realtime — o novo lead aparece automaticamente */}
      <NovoLeadModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(_lead: Lead) => setShowModal(false)}
      />
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Funil de leads — arraste os cards entre colunas para alterar o status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold"
        >
          <UserPlus className="h-4 w-4" />
          Novo lead
        </button>
      </header>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
}
