import { ChoiceOption } from "../../features/survey/types";

interface ChoiceCardProps {
  option: ChoiceOption;
  selected: boolean;
  type: "radio" | "checkbox";
  onSelect: () => void;
}

export function ChoiceCard({ option, selected, type, onSelect }: ChoiceCardProps) {
  return (
    <button
      className={`choice-card ${selected ? "selected" : ""}`}
      type="button"
      onClick={onSelect}
      role={type}
      aria-checked={selected}
    >
      <span className="choice-icon">{option.icon}</span>
      <div className="choice-text">
        <strong>{option.title}</strong>
        <span>{option.description}</span>
      </div>
      <span className={type === "checkbox" ? "check-mark" : "radio-mark"} />
    </button>
  );
}

