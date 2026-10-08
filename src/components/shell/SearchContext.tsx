"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface SearchApi {
  query: string;
  setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchApi>({ query: "", setQuery: () => {} });

/**
 * The header search box filters the table of the screen you are on. The text is
 * cleared when you switch screens so a stale query never hides another table's rows.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQueryState] = useState("");
  const pathname = usePathname();
  useEffect(() => {
    setQueryState("");
  }, [pathname]);
  const setQuery = useCallback((q: string) => setQueryState(q), []);
  const value = useMemo(() => ({ query, setQuery }), [query, setQuery]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useGlobalSearch() {
  return useContext(SearchContext);
}
