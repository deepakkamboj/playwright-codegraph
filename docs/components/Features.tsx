import React from "react";

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

export function Feature({ icon, title, children }: FeatureProps) {
  return (
    <div className="feature-item">
      <div className="feature-icon">
        {icon}
      </div>
      <div className="feature-copy">
        <strong style={{ fontWeight: 600 }}>{title}</strong>
        <span>: {children}</span>
      </div>
    </div>
  );
}

interface FeaturesProps {
  children: React.ReactNode;
}

export function Features({ children }: FeaturesProps) {
  return <div className="feature-list">{children}</div>;
}
