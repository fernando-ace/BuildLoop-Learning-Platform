"use client";

export interface ChoiceOption {
  id: string;
  label: string;
  detail?: string;
}

export function ChoiceList({
  options,
  value,
  onChange,
  variant = "selection",
  label,
}: {
  options: readonly ChoiceOption[];
  value: string;
  onChange: (id: string) => void;
  variant?: "selection" | "iteration";
  label: string;
}) {
  return <div className={variant === "selection" ? "selection-list" : "iteration-list"} role="group" aria-label={label}>
    {options.map((option, index) => <button
      key={option.id}
      className={`${variant === "selection" ? "selection-card" : "iteration-row"}${value === option.id ? " is-selected" : ""}`}
      onClick={() => onChange(option.id)}
      type="button"
      aria-pressed={value === option.id}
    >
      <span className="selection-index">{String(index + 1).padStart(2, "0")}</span>
      {variant === "selection"
        ? <span className="selection-text">{option.label}</span>
        : <span className="iteration-text"><strong>{option.label}</strong>{option.detail && <small>Evidence: {option.detail}</small>}</span>}
      <span className="selection-radio" />
    </button>)}
  </div>;
}
