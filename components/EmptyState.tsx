import { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="animate-fade-in-up flex flex-col items-center text-center py-20 px-6 rounded-card border border-dashed border-line bg-white/50">
      {icon && (
        <div className="mb-4 w-16 h-16 rounded-full bg-moss-light flex items-center justify-center text-moss">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-ink mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-ink/70 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
