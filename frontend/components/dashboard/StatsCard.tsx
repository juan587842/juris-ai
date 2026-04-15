import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

const variantStyles = {
  default: "border-border",
  success: "border-green-500/30 bg-green-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  danger: "border-red-500/30 bg-red-500/5",
};

const iconStyles = {
  default: "text-primary bg-primary/10",
  success: "text-green-400 bg-green-500/10",
  warning: "text-yellow-400 bg-yellow-500/10",
  danger: "text-red-400 bg-red-500/10",
};

export function StatsCard({
  icon: Icon,
  label,
  value,
  subtitle,
  variant = "default",
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "glass-card rounded-xl border p-5 flex items-start gap-4",
        variantStyles[variant]
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          iconStyles[variant]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="label-caps">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
