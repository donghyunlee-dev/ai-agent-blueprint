import { RefObject, useEffect } from "react";

export function useCustomCursor(
  cursorRef: RefObject<HTMLDivElement | null>,
  ringRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer:fine)").matches) return;

    const cursor = cursorRef.current;
    const ring = ringRef.current;
    if (!cursor || !ring) return;

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    let frameId = 0;

    const onMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      cursor.style.transform = `translate(${mouseX - 5}px, ${mouseY - 5}px)`;
    };

    const loop = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.transform = `translate(${ringX - 18}px, ${ringY - 18}px)`;
      frameId = window.requestAnimationFrame(loop);
    };

    const expand = () => {
      ring.style.width = "56px";
      ring.style.height = "56px";
      ring.style.marginLeft = "-10px";
      ring.style.marginTop = "-10px";
    };

    const collapse = () => {
      ring.style.width = "36px";
      ring.style.height = "36px";
      ring.style.marginLeft = "0";
      ring.style.marginTop = "0";
    };

    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>("a, button"),
    );

    document.addEventListener("mousemove", onMove);
    interactive.forEach((node) => {
      node.addEventListener("mouseenter", expand);
      node.addEventListener("mouseleave", collapse);
    });
    loop();

    return () => {
      document.removeEventListener("mousemove", onMove);
      interactive.forEach((node) => {
        node.removeEventListener("mouseenter", expand);
        node.removeEventListener("mouseleave", collapse);
      });
      window.cancelAnimationFrame(frameId);
    };
  }, [cursorRef, ringRef]);
}

