import { useEffect } from "react";
const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      if (target && (INPUT_TAGS.has(target.tagName) || target.isContentEditable)) {
        return;
      }
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) {
          continue;
        }
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        if (event.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
