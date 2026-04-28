import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface HelpTipProps {
  /** The explanatory text shown on hover */
  content: string;
  /** Optional side for the tooltip (default: top) */
  side?: "top" | "bottom" | "left" | "right";
  /** Optional size of the icon in px (default: 13) */
  size?: number;
  /** Optional className for the trigger wrapper */
  className?: string;
}

/**
 * HelpTip — a small ? icon that shows an explanatory tooltip on hover.
 * Use this next to labels, section headings, or buttons that need clarification.
 *
 * @example
 * <HelpTip content="Credits are consumed each time you run a skill." />
 */
export default function HelpTip({ content, side = "top", size = 13, className }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center justify-center cursor-help shrink-0 ${className ?? ""}`}
          style={{ color: "rgba(255,255,255,0.25)", verticalAlign: "middle" }}
          aria-label="Help"
        >
          <HelpCircle size={size} />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-xs text-xs leading-relaxed"
        style={{
          background: "rgba(14,13,58,0.97)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
