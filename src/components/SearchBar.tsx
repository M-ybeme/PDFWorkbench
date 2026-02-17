import { useEffect, useRef } from "react";
import clsx from "clsx";

type SearchBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  currentMatch: number;
  totalMatches: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  isSearching: boolean;
};

const SearchBar = ({
  query,
  onQueryChange,
  currentMatch,
  totalMatches,
  onNext,
  onPrev,
  onClose,
  isSearching,
}: SearchBarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matchDisplay = isSearching
    ? "Searching..."
    : query.trim()
      ? totalMatches > 0
        ? `${currentMatch + 1} of ${totalMatches}`
        : "No matches"
      : "";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
  };

  const buttonBase =
    "rounded-full border border-slate-300 px-2 py-0.5 text-xs font-semibold disabled:opacity-40 dark:border-white/20";

  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow-sm",
        "dark:border-white/10 dark:bg-slate-800/95",
      )}
      role="search"
      aria-label="Search in PDF"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in document..."
        className="w-40 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500 sm:w-56"
        aria-label="Search text"
      />
      {matchDisplay ? (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {matchDisplay}
        </span>
      ) : null}
      <button
        type="button"
        className={buttonBase}
        onClick={onPrev}
        disabled={totalMatches === 0}
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
      >
        &uarr;
      </button>
      <button
        type="button"
        className={buttonBase}
        onClick={onNext}
        disabled={totalMatches === 0}
        aria-label="Next match"
        title="Next match (Enter)"
      >
        &darr;
      </button>
      <button
        type="button"
        className={clsx(buttonBase, "px-2")}
        onClick={onClose}
        aria-label="Close search"
        title="Close (Escape)"
      >
        &times;
      </button>
    </div>
  );
};

export default SearchBar;
