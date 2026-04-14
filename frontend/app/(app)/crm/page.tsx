import { KanbanBoard } from "@/components/crm/KanbanBoard";

export default function CrmPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Funil de leads — arraste os cards entre colunas para alterar o status.
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
}
