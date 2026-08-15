import { useCallback, useEffect, useRef, useState } from 'react';
import { pageCache } from '../utils/pageCache';

/**
 * Cached list fetch for sidebar pages.
 * - Shows cached rows immediately (no skeleton flash on revisit)
 * - Only skeletons when there is no cached/local data yet
 */
export function useCachedList({
  cacheKey,
  fetcher,
  deps = [],
  mapResult
}) {
  const cached = pageCache.get(cacheKey);
  const [data, setData] = useState(() => cached?.data ?? []);
  const [meta, setMeta] = useState(() => cached?.meta ?? {});
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++reqId.current;
      const hasRows = (pageCache.get(cacheKey)?.data?.length ?? data.length) > 0;
      if (!silent && !hasRows) setLoading(true);
      setError(null);
      try {
        const raw = await fetcher();
        if (id !== reqId.current) return;
        const mapped = mapResult ? mapResult(raw) : raw;
        const nextData = mapped?.data ?? [];
        const nextMeta = mapped?.meta ?? {};
        setData(nextData);
        setMeta(nextMeta);
        pageCache.set(cacheKey, { data: nextData, meta: nextMeta });
      } catch (err) {
        if (id !== reqId.current) return;
        setError(err);
        throw err;
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, ...deps]
  );

  useEffect(() => {
    const hit = pageCache.get(cacheKey);
    if (hit) {
      setData(hit.data ?? []);
      setMeta(hit.meta ?? {});
      setLoading(false);
    } else {
      setLoading(true);
    }
    reload({ silent: Boolean(hit) }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const replaceLocal = useCallback(
    (updater) => {
      setData((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        pageCache.set(cacheKey, { data: next, meta });
        return next;
      });
    },
    [cacheKey, meta]
  );

  return { data, setData: replaceLocal, meta, loading, error, reload };
}
