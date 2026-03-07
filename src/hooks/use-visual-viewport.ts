import { useEffect, useState } from "react";

/**
 * Returns the visual viewport height in pixels.
 * On mobile, this accounts for the on-screen keyboard — when the keyboard
 * opens, the visual viewport shrinks while window.innerHeight stays the same.
 * Falls back to window.innerHeight when the VisualViewport API is unavailable.
 */
export function useVisualViewport() {
  const [height, setHeight] = useState<number>(
    typeof window !== "undefined" ? window.innerHeight : 0
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setHeight(vv.height);
    update();

    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  return height;
}
