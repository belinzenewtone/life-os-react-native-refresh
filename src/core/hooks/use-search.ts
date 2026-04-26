import { useEffect, useState } from 'react';

import { SearchRepository, type SearchResult } from '@/core/repositories/search-repository';

export function useSearch(userId: string | null, term: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!userId || !term.trim()) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      const next = await SearchRepository.query(userId, term);
      if (!mounted) return;
      setResults(next);
      setIsLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [term, userId]);

  return { results, isLoading };
}