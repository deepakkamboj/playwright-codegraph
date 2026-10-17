import React, { useState } from "react";

const stages = [
  {
    id: "change",
    label: "Changed Code",
    short: "Diff",
    detail: "Git establishes the exact committed, staged, unstaged, and untracked change set.",
  },
  {
    id: "scenario",
    label: "Affected Scenarios",
    short: "Flow",
    detail: "Code paths map the change to customer journeys and dependent scenario workflows.",
  },
  {
    id: "test",
    label: "Selected Tests",
    short: "Proof",
    detail: "Unit and Playwright tests run with explicit reasons, or safely expand to the full suite.",
  },
] as const;

export function HeroGraph() {
  const [active, setActive] = useState<(typeof stages)[number]["id"]>("scenario");
  const selected = stages.find((stage) => stage.id === active) ?? stages[1];

  return (
    <div className="hero-graph">
      <div className="hero-graph-flow" aria-label="CodeGraph quality flow">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            <button
              type="button"
              className={`hero-node hero-node-${stage.id}${active === stage.id ? " active" : ""}`}
              aria-pressed={active === stage.id}
              onClick={() => setActive(stage.id)}
              onFocus={() => setActive(stage.id)}
            >
              <span className="hero-node-mark" aria-hidden="true">{stage.short}</span>
              <span>{stage.label}</span>
            </button>
            {index < stages.length - 1 ? <span className="hero-edge" aria-hidden="true">→</span> : null}
          </React.Fragment>
        ))}
      </div>
      <p className="hero-graph-detail" aria-live="polite">
        <strong>{selected.label}:</strong> {selected.detail}
      </p>
    </div>
  );
}
