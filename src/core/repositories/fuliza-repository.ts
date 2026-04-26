import { getDatabase } from '@/core/data/database/client';

export type FulizaLoanRecord = {
  id: string;
  draw_code: string;
  draw_amount_kes: number;
  total_repaid_kes: number;
  status: 'OPEN' | 'PARTIALLY_REPAID' | 'CLOSED';
  draw_date: number | null;
  last_repayment_date: number | null;
};

export type FulizaStatus = {
  net_outstanding: number;
  limit_amount: number;
  available_amount: number | null;
};

function nowIso() {
  return new Date().toISOString();
}

function localId(): string {
  return `fl_${Date.now()}_${Math.round(Math.random() * 10_000)}`;
}

export class FulizaRepository {
  static async getNetOutstanding(userId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(draw_amount_kes - total_repaid_kes), 0.0) as total
       FROM fuliza_loans
       WHERE user_id = ? AND status != 'CLOSED' AND deleted_at IS NULL`,
      userId,
    );
    return row?.total ?? 0;
  }

  static async getStatus(userId: string): Promise<FulizaStatus> {
    const db = await getDatabase();
    const [netRow, fulizaRow] = await Promise.all([
      db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(draw_amount_kes - total_repaid_kes), 0.0) as total
         FROM fuliza_loans WHERE user_id = ? AND status != 'CLOSED' AND deleted_at IS NULL`,
        userId,
      ),
      db.getFirstAsync<{ limit_amount: number; available_amount: number | null }>(
        `SELECT limit_amount, available_amount FROM fuliza_loans WHERE user_id = ? AND deleted_at IS NULL LIMIT 1`,
        userId,
      ),
    ]);
    return {
      net_outstanding: netRow?.total ?? 0,
      limit_amount: fulizaRow?.limit_amount ?? 0,
      available_amount: fulizaRow?.available_amount ?? null,
    };
  }

  static async recordDraw(
    userId: string,
    drawCode: string,
    drawAmountKes: number,
    drawDate: number,
  ): Promise<void> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM fuliza_loans WHERE user_id = ? AND draw_code = ? AND deleted_at IS NULL LIMIT 1',
      userId,
      drawCode,
    );
    if (existing) return;

    const ts = nowIso();
    await db.runAsync(
      `INSERT INTO fuliza_loans
         (user_id,id,draw_code,draw_amount_kes,total_repaid_kes,status,draw_date,last_repayment_date,
          created_at,updated_at,sync_state,record_source,revision,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      userId,
      localId(),
      drawCode,
      drawAmountKes,
      0,
      'OPEN',
      drawDate,
      null,
      ts,
      ts,
      'QUEUED',
      'LOCAL',
      1,
      null,
    );
  }

  static async recordRepayment(
    userId: string,
    drawCode: string,
    repaidAmountKes: number,
    repaymentDate: number,
  ): Promise<void> {
    if (repaidAmountKes <= 0) return;
    const db = await getDatabase();

    const existing = await db.getFirstAsync<FulizaLoanRecord>(
      'SELECT * FROM fuliza_loans WHERE user_id = ? AND draw_code = ? AND status != \'CLOSED\' AND deleted_at IS NULL LIMIT 1',
      userId,
      drawCode,
    );

    if (existing) {
      const newRepaid = existing.total_repaid_kes + repaidAmountKes;
      const newStatus =
        newRepaid >= existing.draw_amount_kes ? 'CLOSED'
          : newRepaid > 0 ? 'PARTIALLY_REPAID'
          : 'OPEN';
      await db.runAsync(
        `UPDATE fuliza_loans
           SET total_repaid_kes = ?,
               status = ?,
               last_repayment_date = ?,
               updated_at = ?,
               sync_state = ?,
               revision = revision + 1
           WHERE user_id = ? AND id = ?`,
        Math.min(newRepaid, existing.draw_amount_kes),
        newStatus,
        repaymentDate,
        nowIso(),
        'QUEUED',
        userId,
        existing.id,
      );
      return;
    }

    let remaining = repaidAmountKes;
    const now = nowIso();
    const openLoans = await db.getAllAsync<FulizaLoanRecord>(
      `SELECT * FROM fuliza_loans
       WHERE user_id = ? AND status != 'CLOSED' AND deleted_at IS NULL
       ORDER BY draw_date ASC`,
      userId,
    );

    for (const loan of openLoans) {
      if (remaining <= 0) break;
      const outstanding = Math.max(0, loan.draw_amount_kes - loan.total_repaid_kes);
      if (outstanding <= 0) continue;
      const applied = Math.min(outstanding, remaining);
      const updatedRepaid = loan.total_repaid_kes + applied;
      const updatedStatus =
        updatedRepaid >= loan.draw_amount_kes ? 'CLOSED'
          : updatedRepaid > 0 ? 'PARTIALLY_REPAID'
          : 'OPEN';
      await db.runAsync(
        `UPDATE fuliza_loans
           SET total_repaid_kes = ?,
               status = ?,
               last_repayment_date = ?,
               updated_at = ?,
               sync_state = ?,
               revision = revision + 1
           WHERE user_id = ? AND id = ?`,
        updatedRepaid,
        updatedStatus,
        repaymentDate,
        now,
        'QUEUED',
        userId,
        loan.id,
      );
      remaining -= applied;
    }
  }

  static async observeOpenLoans(userId: string) {
    const db = await getDatabase();
    return db.getAllAsync<FulizaLoanRecord>(
      `SELECT * FROM fuliza_loans
       WHERE user_id = ? AND status != 'CLOSED' AND deleted_at IS NULL
       ORDER BY draw_date DESC`,
      userId,
    );
  }

  static async setLimit(userId: string, limit: number): Promise<void> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM fuliza_loans WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
      userId,
    );
    const ts = nowIso();
    if (existing) {
      await db.runAsync(
        `UPDATE fuliza_loans SET limit_amount = ?, updated_at = ?, sync_state = ?, revision = revision + 1 WHERE user_id = ? AND id = ?`,
        limit, ts, 'QUEUED', userId, existing.id,
      );
    } else {
      await db.runAsync(
        `INSERT INTO fuliza_loans (user_id,id,draw_code,draw_amount_kes,total_repaid_kes,status,draw_date,created_at,updated_at,sync_state,record_source,revision,deleted_at,limit_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        userId, localId(), '', 0, 0, 'OPEN', null, ts, ts, 'QUEUED', 'LOCAL', 1, null, limit,
      );
    }
  }

  static async setOutstanding(userId: string, outstanding: number): Promise<void> {
    const db = await getDatabase();
    // Get current net outstanding from all open loans
    const currentRow = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(draw_amount_kes - total_repaid_kes), 0.0) as total
       FROM fuliza_loans WHERE user_id = ? AND status != 'CLOSED' AND deleted_at IS NULL`,
      userId,
    );
    const currentOutstanding = currentRow?.total ?? 0;
    const delta = outstanding - currentOutstanding;

    if (delta > 0) {
      // Outstanding increased -> new draw
      const drawCode = `draw_${Date.now()}_${Math.round(Math.random() * 100000)}`;
      await this.recordDraw(userId, drawCode, delta, Date.now());
    } else if (delta < 0) {
      // Outstanding decreased -> repayment across open loans
      await this.recordRepayment(userId, 'auto_repayment', Math.abs(delta), Date.now());
    }
    // If delta === 0, nothing changed
  }

  static async setAvailableLimit(userId: string, available: number): Promise<void> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM fuliza_loans WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
      userId,
    );
    const ts = nowIso();
    if (existing) {
      await db.runAsync(
        `UPDATE fuliza_loans SET available_amount = ?, updated_at = ?, sync_state = ?, revision = revision + 1 WHERE user_id = ? AND id = ?`,
        available, ts, 'QUEUED', userId, existing.id,
      );
    } else {
      await db.runAsync(
        `INSERT INTO fuliza_loans (user_id,id,draw_code,draw_amount_kes,total_repaid_kes,status,draw_date,created_at,updated_at,sync_state,record_source,revision,deleted_at,available_amount,limit_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        userId, localId(), '', 0, 0, 'OPEN', null, ts, ts, 'QUEUED', 'LOCAL', 1, null, available, 0,
      );
    }
  }
}
