import { useCallback, useEffect, useRef, useState } from "react";
const extractPageStrings = async (pdf, pageNumber) => {
    const page = await pdf.doc.getPage(pageNumber);
    const content = await page.getTextContent();
    page.cleanup();
    return content.items
        .filter((item) => "str" in item)
        .map((item) => item.str);
};
const findMatches = (cache, query) => {
    const matches = [];
    const lowerQuery = query.toLowerCase();
    for (const [pageNumber, strings] of cache) {
        for (let itemIndex = 0; itemIndex < strings.length; itemIndex++) {
            const str = strings[itemIndex];
            const lowerStr = str.toLowerCase();
            let offset = 0;
            while (offset < lowerStr.length) {
                const found = lowerStr.indexOf(lowerQuery, offset);
                if (found === -1)
                    break;
                matches.push({ pageNumber, itemIndex, offset: found, length: query.length });
                offset = found + 1;
            }
        }
    }
    matches.sort((a, b) => a.pageNumber - b.pageNumber || a.itemIndex - b.itemIndex || a.offset - b.offset);
    return matches;
};
export function usePdfTextSearch(pdf, currentPage, onNavigateToPage) {
    const [query, setQuery] = useState("");
    const [matches, setMatches] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const cacheRef = useRef(new Map());
    const pdfIdRef = useRef(null);
    const debounceRef = useRef(null);
    // Invalidate cache when PDF changes
    useEffect(() => {
        const id = pdf?.id ?? null;
        if (pdfIdRef.current !== id) {
            cacheRef.current.clear();
            pdfIdRef.current = id;
            setMatches([]);
            setCurrentMatchIndex(0);
            setQuery("");
        }
    }, [pdf?.id]);
    // Debounced search
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        if (!pdf || !query.trim()) {
            setMatches([]);
            setCurrentMatchIndex(0);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                // Build cache for all pages that aren't cached yet
                for (let p = 1; p <= pdf.pageCount; p++) {
                    if (!cacheRef.current.has(p)) {
                        const strings = await extractPageStrings(pdf, p);
                        cacheRef.current.set(p, strings);
                    }
                }
                const found = findMatches(cacheRef.current, query.trim());
                setMatches(found);
                setCurrentMatchIndex(0);
                // Navigate to the first match's page if there are matches
                if (found.length > 0 && found[0]) {
                    onNavigateToPage(found[0].pageNumber);
                }
            }
            catch (err) {
                console.error("Text search failed", err);
                setMatches([]);
            }
            finally {
                setIsSearching(false);
            }
        }, 200);
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, pdf, pdf?.pageCount, onNavigateToPage]);
    const goToNext = useCallback(() => {
        if (matches.length === 0)
            return;
        const next = (currentMatchIndex + 1) % matches.length;
        setCurrentMatchIndex(next);
        const match = matches[next];
        if (match) {
            onNavigateToPage(match.pageNumber);
        }
    }, [matches, currentMatchIndex, onNavigateToPage]);
    const goToPrev = useCallback(() => {
        if (matches.length === 0)
            return;
        const prev = (currentMatchIndex - 1 + matches.length) % matches.length;
        setCurrentMatchIndex(prev);
        const match = matches[prev];
        if (match) {
            onNavigateToPage(match.pageNumber);
        }
    }, [matches, currentMatchIndex, onNavigateToPage]);
    const currentPageMatches = matches.filter((m) => m.pageNumber === currentPage);
    return {
        query,
        setQuery,
        matches,
        currentMatchIndex,
        totalMatches: matches.length,
        goToNext,
        goToPrev,
        isSearching,
        currentPageMatches,
    };
}
