import type { ArticleStatus } from "@/types";
import { STATUS_META } from "@/lib/articles";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ArticleStatus;
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
}

export function StatusBadge({
  status,
  interactive = false,
  active = false,
  onClick,
}: StatusBadgeProps) {
  const meta = STATUS_META[status];
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium transition-all",
    meta.bgColor,
    meta.textColor,
    interactive && "cursor-pointer hover:border-slate-300 hover:bg-white",
    active && "border-[#0071e3] bg-white text-[#0071e3]"
  );

  const content = (
    <>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", meta.dotColor)}
        aria-hidden="true"
      />
      {meta.label}
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}
