import clsx from "clsx";
import { useState } from "react";

import type { SignatureEntry } from "../../state/signatureLibrary";
import type { DrawnStroke, SignaturePlacement, TextPlacement } from "../../lib/signaturePlacement";

export type ToolMode = "signature" | "text" | "symbol" | "pen" | "highlighter";

export type TextDraft = {
  text: string;
  fontSizePt: number;
  color: string;
  widthPct: number;
};

export type SymbolPreset = {
  id: string;
  label: string;
  glyph: string;
};

export const SYMBOL_PRESETS: SymbolPreset[] = [
  { id: "check", label: "Checkmark", glyph: "✔" },
  { id: "cross", label: "Cross", glyph: "✘" },
  { id: "dot", label: "Dot", glyph: "•" },
  { id: "box", label: "Empty box", glyph: "☐" },
  { id: "box-check", label: "Checked box", glyph: "☑" },
];

export const DEFAULT_TEXT_DRAFT: TextDraft = {
  text: "",
  fontSizePt: 18,
  color: "#111827",
  widthPct: 0.35,
};

const formatTimestamp = (value: number) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);

type SignatureRibbonProps = {
  activeTool: ToolMode;
  onActivateTool: (tool: ToolMode) => void;

  // Signature tab
  signatures: SignatureEntry[];
  activeSignatureId: string | null;
  onSelectSignature: (id: string) => void;
  onDeleteSignature: (id: string) => void;
  onOpenBuilder: () => void;

  // Text tab
  textFormValues: TextDraft;
  isEditingTextPlacement: boolean;
  textDraftHasContent: boolean;
  textToolError: string | null;
  activeTextPlacement: TextPlacement | undefined;
  onUpdateTextValue: (value: string) => void;
  onUpdateTextFontSize: (value: number) => void;
  onUpdateTextWidth: (value: number) => void;
  onUpdateTextColor: (value: string) => void;
  onClearTextSelection: () => void;

  // Symbol tab
  symbolPreset: SymbolPreset;
  symbolSize: number;
  symbolColor: string;
  onSetSymbolPreset: (preset: SymbolPreset) => void;
  onSetSymbolSize: (size: number) => void;
  onSetSymbolColor: (color: string) => void;

  // Pen/Highlighter tab
  penColor: string;
  penWidth: number;
  onSetPenColor: (color: string) => void;
  onSetPenWidth: (width: number) => void;
  strokes: DrawnStroke[];
  onClearStrokes: () => void;
  onDeleteStroke: (id: string) => void;

  // Placements
  placements: SignaturePlacement[];
  textPlacements: TextPlacement[];
  selectedPlacementId: string | null;
  selectedTextId: string | null;
  onSelectPlacement: (id: string, pageNumber: number) => void;
  onDeletePlacement: (id: string) => void;
  onSelectTextPlacement: (id: string, pageNumber: number) => void;
  onDeleteTextPlacement: (id: string) => void;
  onClearAllPlacements: () => void;
  onClearAllTextPlacements: () => void;
  signatureMap: Map<string, SignatureEntry>;
  currentPage: number;

  // Quick access
  canStamp: boolean;
  isStamping: boolean;
  onStamp: () => void;
  downloadMessage: string | null;
  downloadError: string | null;
  historyLength: number;
  onUndo: () => void;
  overlayCount: number;
};

const TOOL_TABS: { id: ToolMode; label: string }[] = [
  { id: "signature", label: "Signature" },
  { id: "text", label: "Text" },
  { id: "symbol", label: "Symbols" },
  { id: "pen", label: "Pen" },
  { id: "highlighter", label: "Highlighter" },
];

const SignatureRibbon = (props: SignatureRibbonProps) => {
  const [placementsOpen, setPlacementsOpen] = useState(false);

  const totalPlacements =
    props.placements.length + props.textPlacements.length + props.strokes.length;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      {/* Tab bar + quick access */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-1">
          {TOOL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => props.onActivateTool(tab.id)}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
                props.activeTool === tab.id
                  ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-white/10 sm:block" />

        <button
          type="button"
          className={clsx(
            "rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
            placementsOpen
              ? "border-slate-900 bg-slate-900/5 text-slate-900 dark:border-white dark:bg-white/10 dark:text-white"
              : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-300",
          )}
          onClick={() => setPlacementsOpen((v) => !v)}
        >
          {totalPlacements > 0 ? `${totalPlacements} items` : "Items"} {placementsOpen ? "▲" : "▼"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {props.downloadError ? (
            <span className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              {props.downloadError}
            </span>
          ) : null}
          {props.downloadMessage ? (
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
              {props.downloadMessage}
            </span>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:text-slate-300"
            disabled={props.historyLength === 0}
            onClick={props.onUndo}
          >
            Undo{props.historyLength > 0 ? ` (${props.historyLength})` : ""}
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900"
            disabled={!props.canStamp}
            onClick={props.onStamp}
          >
            {props.isStamping ? "Stamping..." : "Stamp & download"}
          </button>
        </div>
      </div>

      {/* Active tab panel */}
      <div className="px-3 py-2">
        {props.activeTool === "signature" && <SignaturePanel {...props} />}
        {props.activeTool === "text" && <TextPanel {...props} />}
        {props.activeTool === "symbol" && <SymbolPanel {...props} />}
        {props.activeTool === "pen" && <PenPanel {...props} tool="pen" />}
        {props.activeTool === "highlighter" && <PenPanel {...props} tool="highlighter" />}
      </div>

      {/* Collapsible placements drawer */}
      {placementsOpen ? <PlacementsDrawer {...props} /> : null}
    </div>
  );
};

/* ── Signature tab ─────────────────────────────────────────── */

const SignaturePanel = (props: SignatureRibbonProps) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
      onClick={props.onOpenBuilder}
    >
      + New
    </button>
    {props.signatures.length === 0 ? (
      <p className="text-sm text-slate-500 dark:text-slate-300">
        Create a signature to unlock placement controls.
      </p>
    ) : (
      <div className="flex gap-2 overflow-x-auto py-1">
        {props.signatures.map((sig) => (
          <div
            key={sig.id}
            className={clsx(
              "flex shrink-0 items-center gap-2 rounded-lg border px-2 py-1.5 transition",
              props.activeSignatureId === sig.id
                ? "border-slate-900 bg-slate-900/90 text-white dark:border-white dark:bg-white/95 dark:text-slate-900"
                : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-200",
            )}
          >
            <button
              type="button"
              className="flex items-center gap-2"
              onClick={() => props.onSelectSignature(sig.id)}
            >
              <img
                src={sig.dataUrl}
                alt={sig.label}
                className="h-10 w-16 rounded bg-white object-contain"
              />
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold">{sig.label}</span>
                <span className="text-[0.6rem] text-slate-400">
                  {formatTimestamp(sig.lastUsedAt ?? sig.createdAt)}
                </span>
              </div>
            </button>
            <button
              type="button"
              className="text-[0.6rem] font-semibold uppercase tracking-widest text-rose-500"
              onClick={() => props.onDeleteSignature(sig.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

/* ── Text tab ──────────────────────────────────────────────── */

const TextPanel = (props: SignatureRibbonProps) => (
  <div className="flex flex-wrap items-start gap-3">
    <div className="min-w-[200px] flex-1">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider">Text content</span>
        {props.isEditingTextPlacement && props.activeTextPlacement ? (
          <span className="font-semibold text-emerald-500">
            Editing page {props.activeTextPlacement.pageNumber}
          </span>
        ) : null}
      </div>
      <textarea
        value={props.textFormValues.text}
        onChange={(e) => props.onUpdateTextValue(e.target.value)}
        placeholder="Type here, then click the PDF to drop it."
        className="mt-1 h-16 w-full resize-none rounded-lg border border-slate-200/70 bg-white/90 px-2 py-1.5 text-sm text-slate-900 outline-none ring-2 ring-transparent transition focus:ring-slate-900/40 dark:border-white/10 dark:bg-slate-900/40 dark:text-white"
      />
      {props.textToolError ? (
        <p className="mt-1 text-xs text-rose-500">{props.textToolError}</p>
      ) : null}
      <div className="mt-0.5 flex items-center justify-between text-[0.65rem] text-slate-400">
        <span>{props.textFormValues.text.length} chars</span>
        {props.isEditingTextPlacement ? (
          <button
            type="button"
            className="font-semibold uppercase tracking-wider text-slate-500"
            onClick={props.onClearTextSelection}
          >
            Done editing
          </button>
        ) : null}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <label className="flex flex-col text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
        Size
        <input
          type="number"
          min={8}
          max={48}
          value={props.textFormValues.fontSizePt}
          onChange={(e) => props.onUpdateTextFontSize(Number(e.target.value) || 0)}
          className="mt-0.5 w-16 rounded-lg border border-slate-200/70 bg-white/90 px-2 py-1 text-sm font-semibold text-slate-900 outline-none dark:border-white/10 dark:bg-slate-900/40 dark:text-white"
        />
      </label>
      <label className="flex flex-col text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
        Color
        <input
          type="color"
          value={props.textFormValues.color}
          onChange={(e) => props.onUpdateTextColor(e.target.value)}
          className="mt-0.5 h-8 w-10 cursor-pointer rounded-lg border border-slate-200/70 bg-white/90 p-0.5 dark:border-white/10 dark:bg-slate-900/40"
        />
      </label>
      <label className="flex flex-col text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
        Width
        <input
          type="range"
          min="0.15"
          max="0.9"
          step="0.05"
          value={props.textFormValues.widthPct}
          onChange={(e) => props.onUpdateTextWidth(parseFloat(e.target.value))}
          className="mt-0.5 w-24"
        />
        <span className="text-[0.6rem] normal-case text-slate-500">
          {Math.round(props.textFormValues.widthPct * 100)}%
        </span>
      </label>
    </div>

    <button
      type="button"
      className={clsx(
        "shrink-0 self-center rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
        props.activeTool === "text"
          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
          : "border-slate-200 text-slate-500 hover:border-slate-300",
      )}
      onClick={() => props.onActivateTool("text")}
      disabled={!props.textDraftHasContent && !props.isEditingTextPlacement}
    >
      {props.isEditingTextPlacement
        ? "Finish editing"
        : props.activeTool === "text"
          ? "Click PDF to place"
          : "Use text tool"}
    </button>
  </div>
);

/* ── Symbol tab ────────────────────────────────────────────── */

const SymbolPanel = (props: SignatureRibbonProps) => (
  <div className="flex flex-wrap items-center gap-3">
    <div className="flex flex-wrap gap-1.5">
      {SYMBOL_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={clsx(
            "rounded-lg border px-2.5 py-1 text-lg transition",
            props.symbolPreset.id === preset.id
              ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:border-sky-400 dark:text-sky-200"
              : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-200",
          )}
          onClick={() => props.onSetSymbolPreset(preset)}
          title={preset.label}
        >
          {preset.glyph}
        </button>
      ))}
    </div>

    <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-white/10 sm:block" />

    <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
      Size
      <input
        type="range"
        min={12}
        max={40}
        step={1}
        value={props.symbolSize}
        onChange={(e) => props.onSetSymbolSize(parseFloat(e.target.value))}
        className="w-20"
      />
      <span className="text-[0.6rem] normal-case text-slate-500">{props.symbolSize}pt</span>
    </label>

    <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
      Color
      <input
        type="color"
        value={props.symbolColor}
        onChange={(e) => props.onSetSymbolColor(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded-lg border border-slate-200/70 bg-white/90 p-0.5 dark:border-white/10 dark:bg-slate-900/40"
      />
    </label>

    <span className="text-xs text-slate-400">Click the PDF to drop the symbol.</span>
  </div>
);

/* ── Pen / Highlighter tab ─────────────────────────────────── */

const PenPanel = (props: SignatureRibbonProps & { tool: "pen" | "highlighter" }) => (
  <div className="flex flex-wrap items-center gap-3">
    <span className="text-xs text-slate-500 dark:text-slate-300">
      {props.tool === "highlighter"
        ? "Draw translucent highlights directly on the page."
        : "Draw freehand strokes directly on the page."}
    </span>

    <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-white/10 sm:block" />

    <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
      Width
      <input
        type="range"
        min={1}
        max={12}
        step={1}
        value={props.penWidth}
        onChange={(e) => props.onSetPenWidth(Number(e.target.value))}
        className="w-20"
      />
      <span className="text-[0.6rem] normal-case text-slate-500">{props.penWidth}px</span>
    </label>

    <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
      Color
      <input
        type="color"
        value={props.penColor}
        onChange={(e) => props.onSetPenColor(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded-lg border border-slate-200/70 bg-white/90 p-0.5 dark:border-white/10 dark:bg-slate-900/40"
      />
    </label>

    {props.strokes.length > 0 ? (
      <button
        type="button"
        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:border-slate-300"
        onClick={props.onClearStrokes}
      >
        Clear all strokes
      </button>
    ) : null}
  </div>
);

/* ── Placements drawer ─────────────────────────────────────── */

const PlacementsDrawer = (props: SignatureRibbonProps) => {
  const strokesOnPage = props.strokes.filter((s) => s.pageNumber === props.currentPage);

  return (
    <div className="max-h-[240px] overflow-y-auto border-t border-slate-200/70 px-3 py-2 dark:border-white/10">
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Signature placements */}
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
              Signatures
            </h4>
            {props.placements.length > 0 ? (
              <button
                type="button"
                className="text-[0.6rem] font-semibold uppercase tracking-widest text-slate-400"
                onClick={props.onClearAllPlacements}
              >
                Clear
              </button>
            ) : null}
          </div>
          {props.placements.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400">No signature placements yet.</p>
          ) : (
            <ul className="mt-1 space-y-1" data-testid="placements-list">
              {props.placements.map((p) => {
                const sig = props.signatureMap.get(p.signatureId);
                return (
                  <li
                    key={p.id}
                    className={clsx(
                      "flex items-center justify-between rounded-lg border px-2 py-1 text-xs",
                      p.id === props.selectedPlacementId
                        ? "border-indigo-500 bg-indigo-50/80 dark:border-indigo-400 dark:bg-indigo-500/10"
                        : "border-slate-200 dark:border-white/10",
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-col text-left"
                      onClick={() => props.onSelectPlacement(p.id, p.pageNumber)}
                    >
                      <span className="font-semibold text-slate-700 dark:text-white">
                        {sig?.label ?? "Missing"}
                      </span>
                      <span className="text-[0.6rem] text-slate-400">Page {p.pageNumber}</span>
                    </button>
                    <button
                      type="button"
                      className="text-[0.6rem] font-semibold uppercase tracking-widest text-rose-500"
                      onClick={() => props.onDeletePlacement(p.id)}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Text & symbol placements */}
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
              Text & symbols
            </h4>
            {props.textPlacements.length > 0 ? (
              <button
                type="button"
                className="text-[0.6rem] font-semibold uppercase tracking-widest text-slate-400"
                onClick={props.onClearAllTextPlacements}
              >
                Clear
              </button>
            ) : null}
          </div>
          {props.textPlacements.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400">No text placements yet.</p>
          ) : (
            <ul className="mt-1 space-y-1" data-testid="text-placements-list">
              {props.textPlacements.map((tp) => {
                const preview = tp.text.trim() || "(Empty)";
                const truncated = preview.length > 24 ? `${preview.slice(0, 21)}...` : preview;
                return (
                  <li
                    key={tp.id}
                    className={clsx(
                      "flex items-center justify-between rounded-lg border px-2 py-1 text-xs",
                      tp.id === props.selectedTextId
                        ? "border-emerald-500 bg-emerald-50/80 dark:border-emerald-400 dark:bg-emerald-500/10"
                        : "border-slate-200 dark:border-white/10",
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-col text-left"
                      title={preview}
                      onClick={() => props.onSelectTextPlacement(tp.id, tp.pageNumber)}
                    >
                      <span className="font-semibold text-slate-700 dark:text-white">
                        {truncated}
                      </span>
                      <span className="text-[0.6rem] text-slate-400">Page {tp.pageNumber}</span>
                    </button>
                    <button
                      type="button"
                      className="text-[0.6rem] font-semibold uppercase tracking-widest text-rose-500"
                      onClick={() => props.onDeleteTextPlacement(tp.id)}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pen strokes */}
        <div>
          <h4 className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
            Strokes (page {props.currentPage})
          </h4>
          {strokesOnPage.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400">No strokes on this page.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {strokesOnPage.map((stroke, i) => (
                <li
                  key={stroke.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-white/10"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stroke.color, opacity: stroke.opacity }}
                    />
                    <span className="text-slate-600 dark:text-slate-300">
                      {stroke.tool === "highlighter" ? "Highlight" : "Stroke"} {i + 1}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-[0.6rem] font-semibold uppercase tracking-widest text-rose-500"
                    onClick={() => props.onDeleteStroke(stroke.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignatureRibbon;
