import { useCallback, useEffect, useState } from 'react';

import { ImportAuditRepository, type ImportAuditRecord } from '@/core/repositories/import-audit-repository';

export function useImportAudit(userId: string | null) {
  const [items, setItems] = useState<ImportAuditRecord[]>([]);

  const reload = useCallback(async () => {
    if (!userId) return;
    setItems(await ImportAuditRepository.listRecent(userId));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, reload };
}