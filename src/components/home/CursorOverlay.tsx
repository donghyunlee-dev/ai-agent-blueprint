import { useRef } from "react";
import { useCustomCursor } from "../../hooks/useCustomCursor";

export function CursorOverlay() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useCustomCursor(cursorRef, ringRef);

  return (
    <>
      <div className="cursor" ref={cursorRef} aria-hidden="true" />
      <div className="cursor-ring" ref={ringRef} aria-hidden="true" />
    </>
  );
}

