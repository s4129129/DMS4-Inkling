import { useId } from "react";

export default function InstantTooltip({
  label,
  children,
  side = "bottom",
  className = "",
  as = "span",
}) {
  const tooltipId = useId();
  const TooltipElement = as;

  if (!label) {
    return children;
  }

  return (
    <TooltipElement
      className={`instant-tooltip-shell ${className}`.trim()}
      data-side={side}
      aria-describedby={tooltipId}
      tabIndex={0}
    >
      {children}
      <span id={tooltipId} className="instant-tooltip" role="tooltip">
        {label}
      </span>
    </TooltipElement>
  );
}
