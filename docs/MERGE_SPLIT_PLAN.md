# Merge & Split Planning Notes

## Goals for 0.3.x

- Support batching multiple uploaded PDFs, reordering them via drag and drop, and exporting a merged document entirely client-side.
- Allow users to select arbitrary page ranges (individual picks or rules like "every N pages") and export the extracted subset.
- Reuse viewer data (thumbnails, metadata, cached renders) to avoid reloading the same bytes multiple times.

## Proposed Data Structures

### `PdfAsset`
Represents an uploaded file (raw `File`, its `LoadedPdf` metadata, and derived blobs for caching).

```ts
type PdfAsset = {
  id: string;
  file: File;
  loaded: LoadedPdf; // shared with viewer
  pages: PageDescriptor[]; // lazy hydrated as needed
};

type PageDescriptor = {
  pageIndex: number;
  rotation: number;
  selected: boolean;
  renderCacheKey?: string;
};
```

### `MergeWorkspace`
Keeps ordering plus output preferences.

```ts
type MergeWorkspace = {
  queue: PdfAsset[];
  isDirty: boolean;
  outputName: string;
  lastGeneratedUrl?: string;
};
```

### `SplitWorkspace`
Focuses on page-level selections per asset.

```ts
type SplitWorkspace = {
  activeAssetId: string | null;
  selectionMode: "manual" | "every-n";
  everyN?: number;
  selections: Record<string, number[]>; // assetId -> selected page indices
};
```

## Modules to Build

1. **Asset Store**: Zustand slice that tracks uploaded PDFs, exposes helpers (`addAsset`, `removeAsset`, `reorderAsset`).
2. **Merge Engine**: Thin wrapper around `pdf-lib` with methods `mergePdfs(assets: PdfAsset[], order: string[]): Promise<Uint8Array>`.
3. **Split Engine**: Utility `extractPages(asset: PdfAsset, indices: number[]): Promise<Uint8Array>` plus helper to translate "every N" into index arrays.
4. **Download Helper**: Shared function to turn `Uint8Array` into downloadable Blob URLs with cleanup hooks.

## UI Sketch

- **Merge**: stacked cards for each asset with drag handles, inline page counts, and quick actions (preview, remove, move to top/bottom).
- **Split**: viewer-style canvas on the right, thumbnail grid on the left with multi-select, plus preset buttons (odd, even, every 5, etc.).
- **Status Bar**: show total pages selected, estimated output size (once computed), and CTA button states.

## Reuse from Viewer

- Reuse `loadPdfFromFile` / `LoadedPdf` results so thumbnails and metadata only compute once.
- Share the render cache utilities (move to `lib/pageCache.ts` in next phase) so page previews stay instant between tools.
- Hook upcoming error/metadata helpers so merge/split tools inherit richer feedback for unsupported files.

## Next Actions

1. Implement the asset store + context in `state/` so tools share uploaded documents.
2. Build basic Merge UI (list + add/remove) while wiring pdf-lib merge happy path.
3. Layer the Split UI on top of the viewer canvas, ensuring selections sync back to the store.
