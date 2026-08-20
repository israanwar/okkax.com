import React from "react";
import OkxDropdown from "@/components/OkxDropdown";

/*
 * Okkax compatibility adapter.
 *
 * PremiumSelect historically rendered a native <select>.
 * It now delegates rendering to the canonical OkxDropdown while preserving
 * the legacy children + event-shaped onChange API used throughout the app.
 *
 * New code should use OkxDropdown directly.
 */

export const premiumSelectClass = "okx-premium-select";

function childrenToOptions(children) {
  return React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => ({
      value: String(child.props.value ?? ""),
      label:
        typeof child.props.children === "string" ||
        typeof child.props.children === "number"
          ? String(child.props.children)
          : String(child.props.label ?? child.props.value ?? ""),
      disabled: Boolean(child.props.disabled),
    }));
}

export default function PremiumSelect({
  children,
  value,
  onChange,
  className = "",
  compact = false,
  icon,
  disabled = false,
  placeholder = "Pilih",
  "data-testid": testId,
  "aria-label": ariaLabel,
  ...rest
}) {
  const options = childrenToOptions(children);

  const handleChange = (nextValue) => {
    /*
     * Preserve legacy native-select contract:
     * existing callers expect event.target.value.
     */
    onChange?.({
      target: {
        value: nextValue,
        name: rest.name,
      },
      currentTarget: {
        value: nextValue,
        name: rest.name,
      },
    });
  };

  return (
    <OkxDropdown
      value={value}
      onChange={handleChange}
      options={options}
      placeholder={placeholder}
      icon={icon}
      disabled={disabled}
      searchable={rest.searchable ?? false}
      className={className}
      testId={testId}
      ariaLabel={ariaLabel}
    />
  );
}
