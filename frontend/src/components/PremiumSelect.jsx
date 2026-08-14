import { ChevronDown } from "lucide-react";

export const premiumSelectClass = "okx-premium-select";

export default function PremiumSelect({
  children,
  className = "",
  compact = false,
  icon: Icon,
  iconClassName = "",
  ...props
}) {
  return (
    <span className={`okx-select-shell ${compact ? "okx-select-shell--compact" : ""} ${Icon ? "okx-select-shell--icon" : ""} ${className}`}>
      {Icon && (
        <Icon aria-hidden="true" size={compact ? 14 : 16} strokeWidth={1.7}
          className={`okx-select-leading-icon ${iconClassName}`} />
      )}
      <select {...props} className={premiumSelectClass}>
        {children}
      </select>
      <span aria-hidden="true" className="okx-select-divider" />
      <ChevronDown aria-hidden="true" size={compact ? 14 : 16} strokeWidth={1.8}
        className="okx-select-chevron" />
    </span>
  );
}
