import { useEffect, useRef } from "react";
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function useFocusTrap(containerRef, isActive) {
  const previousFocusRef = useRef(null);
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    previousFocusRef.current = document.activeElement;
    const focusableElements = () =>
      Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hidden && getComputedStyle(el).display !== "none",
      );
    const firstFocusable = focusableElements()[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }
    const handleKeyDown = (event) => {
      if (event.key !== "Tab") {
        return;
      }
      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [containerRef, isActive]);
}
