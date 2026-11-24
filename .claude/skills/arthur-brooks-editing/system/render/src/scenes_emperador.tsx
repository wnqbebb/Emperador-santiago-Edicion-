// Escenas propias de Emperador Santiago (extensión del render VES).
// mg_original: motion graphic ORIGINAL (no copiado de la biblioteca) hecho con HyperFrames en la paleta del video,
// reproducido a pantalla completa en su beat.
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

export const MgOriginal: React.FC<{ props: { media?: string }; project: string }> = ({ props, project }) =>
  props.media ? (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={staticFile(`${project}/${props.media}`)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  ) : null;

export const EMPERADOR_REGISTRY = { mg_original: MgOriginal };
