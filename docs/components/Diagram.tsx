import React from "react";
import { asset } from "./base";

export default function Diagram({
  src,
  alt,
  caption,
  width = 1440,
  height = 1000,
}: {
  src: string;
  alt: string;
  caption?: React.ReactNode;
  width?: number;
  height?: number;
}) {
  return (
    <figure className="das-figure">
      <img src={asset(src)} alt={alt} width={width} height={height} loading="lazy" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
