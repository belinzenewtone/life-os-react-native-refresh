/**
 * Confidence-Based Import Filter
 *
 * Implements a tiered import strategy for M-Pesa SMS parsing results:
 *
 *   HIGH confidence   → Import directly (auto-accepted)
 *   MEDIUM confidence → Import with status 'PENDING_REVIEW' (visible but flagged)
 *   LOW confidence    → Quarantine (stored in import_audit only, NOT in transactions)
 *
 * This prevents garbage data from polluting the transaction history while
 * still preserving a record of all received SMS for diagnostics.
 */

import { type ParsedMpesa } from '@/core/platform/sms/mpesa-parser';

export type ImportFilterDecision = {
  action: 'IMPORT' | 'QUARANTINE' | 'PENDING_REVIEW';
  reason: string;
};

export class ConfidenceBasedImportFilter {
  /**
   * Evaluates a parsed M-Pesa message and returns the import decision.
   */
  static evaluate(parsed: ParsedMpesa): ImportFilterDecision {
    // Always quarantine unclassified messages
    if (parsed.type === 'UNKNOWN') {
      return { action: 'QUARANTINE', reason: 'unclassified_message' };
    }

    // HIGH confidence with both code and amount → direct import
    if (parsed.confidence === 'HIGH' && parsed.code && parsed.amount != null && parsed.amount > 0) {
      return { action: 'IMPORT', reason: 'high_confidence_complete' };
    }

    // HIGH confidence but missing code or amount → pending review
    if (parsed.confidence === 'HIGH') {
      return { action: 'PENDING_REVIEW', reason: 'high_confidence_incomplete' };
    }

    // MEDIUM confidence → pending review (user can approve/deny)
    if (parsed.confidence === 'MEDIUM') {
      return { action: 'PENDING_REVIEW', reason: 'medium_confidence' };
    }

    // LOW confidence → quarantine (do not import)
    return { action: 'QUARANTINE', reason: 'low_confidence' };
  }

  /**
   * Returns true if the decision allows the record into transactions table.
   */
  static shouldImport(decision: ImportFilterDecision): boolean {
    return decision.action === 'IMPORT' || decision.action === 'PENDING_REVIEW';
  }
}
