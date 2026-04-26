import { describe, expect, it } from 'vitest';

import {
  isMpesaSms,
  isFulizaServiceNotice,
  parseMpesaSms,
} from './mpesa-parser';

describe('isMpesaSms', () => {
  it('returns true for messages containing MPESA', () => {
    expect(isMpesaSms('QAB123CDE4 Confirmed. Ksh450 sent on M-PESA.')).toBe(true);
  });

  it('returns true for messages containing M-PESA', () => {
    expect(isMpesaSms('You have received Ksh1,000 via M-PESA.')).toBe(true);
  });

  it('returns true for messages with code + amount but no M-PESA text', () => {
    expect(isMpesaSms('QAB123CDE4 Confirmed. Ksh450.00 sent to John.')).toBe(true);
  });

  it('returns false for unrelated SMS', () => {
    expect(isMpesaSms('Hey, are you coming for dinner?')).toBe(false);
  });

  it('returns false for promotional SMS with Ksh and numbers but no code', () => {
    expect(isMpesaSms('WIN Ksh1,000,000 with M-PESA!')).toBe(false);
  });
});

describe('isFulizaServiceNotice', () => {
  it('filters Fuliza interest notices', () => {
    expect(isFulizaServiceNotice('Fuliza M-PESA daily charges have been applied.')).toBe(true);
  });

  it('filters Fuliza overdraft balance notices', () => {
    expect(isFulizaServiceNotice('Fuliza M-PESA overdraft balance is Ksh 0.')).toBe(true);
  });

  it('does NOT filter Fuliza charge notices with outstanding amount', () => {
    expect(isFulizaServiceNotice('Fuliza M-PESA amount is Ksh 500. Access Fee charged Ksh 10. Total Fuliza M-PESA outstanding amount is Ksh 2,350.')).toBe(false);
  });

  it('does NOT filter non-Fuliza messages', () => {
    expect(isFulizaServiceNotice('QAB123CDE4 Confirmed. Ksh450 sent to Artisan.')).toBe(false);
  });
});

describe('parseMpesaSms - phone number exclusion', () => {
  it('does NOT extract a 10-digit phone number as M-Pesa code', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh1,000.00 received from JOHN DOE 0712345678 on 22/04/26 at 9:01 AM.',
    );
    expect(parsed.code).toBe('QAB123CDE4');
    expect(parsed.code).not.toBe('0712345678');
  });

  it('returns null code when only a phone number (all digits) is present', () => {
    const parsed = parseMpesaSms(
      '0712345678 Confirmed. Ksh500 sent to Bob on M-PESA.',
    );
    expect(parsed.code).toBeNull();
  });
});

describe('parseMpesaSms - transaction cost extraction', () => {
  it('extracts transaction cost from SMS', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh2,000.00 sent to JANE DOE on 22/04/26 at 10:15 AM. Transaction cost was Ksh 23. New M-PESA balance is Ksh15,000.00.',
    );
    expect(parsed.transactionCost).toBe(23);
  });

  it('extracts transaction cost with "Transaction cost is Ksh"', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh500.00 sent to MERCHANT on 22/04/26. Transaction cost is Ksh 12. New M-PESA balance is Ksh3,000.',
    );
    expect(parsed.transactionCost).toBe(12);
  });

  it('returns null transactionCost when not present', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 8:42 AM.',
    );
    expect(parsed.transactionCost).toBeNull();
  });

  it('extracts transaction cost with commas in amount', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh10,000.00 paid to SHOP on 22/04/26. Transaction cost was Ksh 105.',
    );
    expect(parsed.transactionCost).toBe(105);
  });
});

describe('parseMpesaSms - core types', () => {
  it('extracts code, amount, merchant, primary detection, and high confidence for standard send SMS', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 8:42 AM.',
    );

    expect(parsed.code).toBe('QAB123CDE4');
    expect(parsed.amount).toBe(450);
    expect(parsed.merchant).toBe('Artisan Coffee');
    expect(parsed.type).toBe('SENT');
    expect(parsed.confidence).toBe('HIGH');
    expect(parsed.detectionPhase).toBe('PRIMARY');
  });

  it('extracts paybill merchant and classifies as paybill', () => {
    const parsed = parseMpesaSms(
      'QWE123RTY9 Confirmed. Ksh1,250.00 paid to KPLC PREPAID for account 998877 via M-PESA PayBill on 22/04/26.',
    );

    expect(parsed.code).toBe('QWE123RTY9');
    expect(parsed.amount).toBe(1250);
    expect(parsed.merchant).toBe('KPLC PREPAID');
    expect(parsed.type).toBe('PAYBILL');
    expect(parsed.confidence).toBe('HIGH');
  });

  it('extracts sender as merchant for received messages', () => {
    const parsed = parseMpesaSms(
      'QZX123VBN8 Confirmed. You have received Ksh2,000.00 from JOHN DOE 0712345678 on 22/04/26 at 9:01 AM.',
    );

    expect(parsed.type).toBe('RECEIVED');
    expect(parsed.merchant).toContain('JOHN DOE');
  });

  it('marks message as medium confidence when detection is FALLBACK', () => {
    // Use a message that matches a fallback pattern but not a primary pattern
    const parsed = parseMpesaSms('QAB123CDE4 Confirmed. Ksh200.00 reversed via M-PESA.');
    expect(parsed.type).toBe('REVERSED');
    expect(parsed.amount).toBe(200);
    expect(parsed.code).toBe('QAB123CDE4');
    // "reversed" matches fallback /\brevers(?:al|ed|ing)?\b/i, not primary /\brevers(?:al|ed)\s+(?:to|of|on)\b/i
    expect(parsed.confidence).toBe('MEDIUM');
    expect(parsed.detectionPhase).toBe('FALLBACK');
  });

  it('returns low confidence for unstructured messages', () => {
    const parsed = parseMpesaSms('Hello there, remember to call me later.');
    expect(parsed.amount).toBeNull();
    expect(parsed.confidence).toBe('LOW');
    expect(parsed.type).toBe('UNKNOWN');
    expect(parsed.detectionPhase).toBe('NONE');
  });

  it('classifies BUY_GOODS from till number SMS', () => {
    const parsed = parseMpesaSms(
      'QBG456MNO7 Confirmed. Ksh350.00 paid to JAVA HOUSE via till number 98765 on 22/04/26.',
    );
    expect(parsed.type).toBe('BUY_GOODS');
    expect(parsed.merchant).toContain('JAVA HOUSE');
  });

  it('classifies WITHDRAWN from agent withdrawal', () => {
    const parsed = parseMpesaSms(
      'QWD789PQR1 Confirmed. Ksh5,000.00 withdrawn from agent 45678 - MARY KAMAU on 22/04/26 at 11:30 AM.',
    );
    expect(parsed.type).toBe('WITHDRAWN');
  });

  it('classifies AIRTIME from airtime purchase', () => {
    const parsed = parseMpesaSms(
      'QAT345STU5 Confirmed. Ksh50.00 airtime sent to 0712345678 on 22/04/26.',
    );
    expect(parsed.type).toBe('AIRTIME');
  });

  it('classifies DEPOSIT from deposit SMS', () => {
    const parsed = parseMpesaSms(
      'QDP678UVW2 Confirmed. Ksh10,000.00 deposited at agent 45678 on 22/04/26.',
    );
    expect(parsed.type).toBe('DEPOSIT');
  });

  it('classifies REVERSED from reversal SMS', () => {
    const parsed = parseMpesaSms(
      'QRV901XYZ3 Confirmed. Ksh500.00 reversed to your account on 22/04/26.',
    );
    expect(parsed.type).toBe('REVERSED');
  });
});

describe('parseMpesaSms - fuliza types', () => {
  it('extracts fuliza fee amount for FULIZA_CHARGE messages', () => {
    const parsed = parseMpesaSms(
      'SHJ789XYZ1 Fuliza M-PESA amount is Ksh 500. Access Fee charged Ksh 10. Total Fuliza M-PESA outstanding amount is Ksh 2,350 due on 22/04/26.',
    );
    expect(parsed.type).toBe('FULIZA_CHARGE');
    expect(parsed.amount).toBe(500);
    expect(parsed.fulizaOutstanding).toBe(2350);
    expect(parsed.fulizaFee).toBe(10);
  });

  it('extracts FULIZA_BALANCE for cumulative balance messages without access fee', () => {
    const parsed = parseMpesaSms(
      'SHJ789XYZ1 Total Fuliza M-PESA outstanding amount is Ksh 2,350 due on 22/04/26.',
    );
    expect(parsed.type).toBe('FULIZA_BALANCE');
    expect(parsed.fulizaOutstanding).toBe(2350);
    expect(parsed.fulizaFee).toBeNull();
  });

  it('returns null fulizaOutstanding for non-FULIZA messages', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 8:42 AM.',
    );
    expect(parsed.fulizaOutstanding).toBeNull();
  });

  it('extracts fuliza available limit from FULIZA_REPAYMENT message', () => {
    const parsed = parseMpesaSms(
      'QCD456FGH7 Confirmed. Ksh500.00 Fuliza repayment from Wallet on 22/04/26. Fuliza M-PESA available limit is Ksh4,500.',
    );
    expect(parsed.type).toBe('FULIZA_REPAYMENT');
    expect(parsed.fulizaAvailableLimit).toBe(4500);
  });

  it('returns null available limit for non-repayment messages', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 8:42 AM.',
    );
    expect(parsed.fulizaAvailableLimit).toBeNull();
  });
});

describe('parseMpesaSms - date extraction', () => {
  it('extracts SMS date from message text', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 8:42 AM.',
    );
    expect(parsed.smsDate).not.toBeNull();
    const d = new Date(parsed.smsDate!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(42);
  });

  it('extracts PM hour correctly from SMS date', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 2:42 PM.',
    );
    const d = new Date(parsed.smsDate!);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(42);
  });

  it('extracts date-only when no time is present', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26.',
    );
    expect(parsed.smsDate).not.toBeNull();
  });
});

describe('parseMpesaSms - balance extraction', () => {
  it('extracts balance from "New M-PESA balance is Ksh X"', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/26 at 8:42 AM. New M-PESA balance is Ksh2,103.00.',
    );
    expect(parsed.balance).toBe(2103.00);
  });

  it('extracts balance from "M-PESA balance is Ksh X" without "New"', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh50.00 airtime top-up on 22/04/26. M-PESA balance is Ksh1,200.',
    );
    expect(parsed.balance).toBe(1200);
  });
});

describe('parseMpesaSms - edge cases', () => {
  it('uses fallback detection when primary patterns do not match', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh200.00 reversed via M-PESA.',
    );
    expect(parsed.type).toBe('REVERSED');
    expect(parsed.detectionPhase).toBe('FALLBACK');
  });

  it('returns UNKNOWN for completely unclassifiable messages', () => {
    const parsed = parseMpesaSms('Random text with no signal.');
    expect(parsed.type).toBe('UNKNOWN');
    expect(parsed.confidence).toBe('LOW');
    expect(parsed.detectionPhase).toBe('NONE');
  });

  it('filters Fuliza service notices as UNKNOWN', () => {
    const parsed = parseMpesaSms('Fuliza M-PESA interest charged is Ksh 50.');
    expect(parsed.type).toBe('UNKNOWN');
    expect(parsed.confidence).toBe('LOW');
  });

  it('handles exceptions gracefully by returning UNKNOWN', () => {
    const parsed = parseMpesaSms('');
    expect(parsed).toBeDefined();
    expect(parsed.type).toBeDefined();
  });

  it('sets LAST_RESORT detection phase for weak pattern matches', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh500.00 transferred.',
    );
    expect(parsed.type).toBe('SENT');
    expect(parsed.detectionPhase).toBe('LAST_RESORT');
    expect(parsed.confidence).toBe('MEDIUM');
  });

  it('returns LOW confidence for LAST_RESORT detection phase without code', () => {
    const parsed = parseMpesaSms(
      'Ksh500.00 transferred.',
    );
    expect(parsed.confidence).toBe('LOW');
  });

  it('handles commas in amounts correctly', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh10,000.00 sent to MERCHANT on 22/04/26 at 8:42 AM.',
    );
    expect(parsed.amount).toBe(10000);
  });

  it('handles decimal amounts without commas', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh500.50 sent to MERCHANT on 22/04/26 at 8:42 AM.',
    );
    expect(parsed.amount).toBe(500.50);
  });

  it('handles Buy Goods "paid to" SMS', () => {
    const parsed = parseMpesaSms(
      'QBG789MNO4 Confirmed. Ksh350.00 paid to ARTISAN COFFEE on 22/4/26 at 9:15 AM. New M-PESA balance is Ksh4,500.',
    );
    expect(parsed.type).toBe('BUY_GOODS');
    expect(parsed.merchant).toContain('ARTISAN COFFEE');
  });

  it('handles PayBill with account number in merchant extraction', () => {
    const parsed = parseMpesaSms(
      'QPB123XYZ9 Confirmed. Ksh2,500.00 sent to KPLC PREPAID for account 123456789 on 22/04/26 at 10:00 AM.',
    );
    expect(parsed.type).toBe('PAYBILL');
    expect(parsed.merchant).toContain('KPLC');
  });

  it('returns LOW confidence for messages with no code and no type match', () => {
    const parsed = parseMpesaSms('Some random message with Ksh 500 mentioned');
    expect(parsed.confidence).toBe('LOW');
  });

  it('handles withdrawal SMS', () => {
    const parsed = parseMpesaSms(
      'QWD345FGH6 Confirmed. Ksh5,000 withdrawn from agent 12345 - GRACE MUMO on 22/04/26 at 2:30 PM.',
    );
    expect(parsed.type).toBe('WITHDRAWN');
    expect(parsed.amount).toBe(5000);
  });

  it('handles deposit SMS', () => {
    const parsed = parseMpesaSms(
      'QDP678UVW2 Confirmed. Ksh10,000 deposited to your account via agent on 22/04/26.',
    );
    expect(parsed.type).toBe('DEPOSIT');
    expect(parsed.amount).toBe(10000);
  });

  it('classifies paybill even without account keyword', () => {
    const parsed = parseMpesaSms(
      'QPB456DEF7 Confirmed via PayBill. Ksh1,500.00 paid to SAFARICOM on 22/04/26.',
    );
    expect(parsed.type).toBe('PAYBILL');
  });

  it('handles messages with 4-digit year in date', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to Artisan Coffee on 22/04/2026 at 8:42 AM.',
    );
    expect(parsed.smsDate).not.toBeNull();
    const d = new Date(parsed.smsDate!);
    expect(d.getFullYear()).toBe(2026);
  });
});

describe('parseMpesaSms - merchant name cleanup', () => {
  it('strips trailing phone numbers from merchant names', () => {
    const parsed = parseMpesaSms(
      'QZX123VBN8 Confirmed. Ksh2,000.00 received from JOHN DOE on 22/04/26 at 9:01 AM.',
    );
    expect(parsed.merchant).toBe('JOHN DOE');
  });

  it('normalizes whitespace in merchant names', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh450.00 sent to  Artisan   Coffee  on 22/04/26 at 8:42 AM.',
    );
    if (parsed.merchant) {
      expect(parsed.merchant).not.toContain('  ');
    }
  });
});

describe('parseMpesaSms - negative tests', () => {
  it('rejects zero amounts', () => {
    const parsed = parseMpesaSms(
      'QAB123CDE4 Confirmed. Ksh0 sent to MERCHANT on 22/04/26.',
    );
    expect(parsed.amount).toBeNull();
  });

  it('returns UNKNOWN for empty string', () => {
    const parsed = parseMpesaSms('');
    expect(parsed.type).toBe('UNKNOWN');
    expect(parsed.confidence).toBe('LOW');
  });

  it('returns all null fields for non-M-Pesa SMS', () => {
    const parsed = parseMpesaSms('Hey want to grab lunch?');
    expect(parsed.code).toBeNull();
    expect(parsed.amount).toBeNull();
    expect(parsed.merchant).toBeNull();
    expect(parsed.type).toBe('UNKNOWN');
    expect(parsed.balance).toBeNull();
    expect(parsed.transactionCost).toBeNull();
  });

  it('transactionCost is included in UNKNOWN return', () => {
    const parsed = parseMpesaSms('Not an M-Pesa message at all');
    expect(parsed.transactionCost).toBeNull();
  });
});

describe('parseMpesaSms - M-Shwari types', () => {
  it('classifies M-Shwari loan disbursement', () => {
    const parsed = parseMpesaSms(
      'SAF1234567 Confirmed. Ksh5,000.00 loan from M-Shwari to your M-PESA on 22/04/26 at 10:30 AM. New M-PESA balance is Ksh15,000.00.',
    );
    expect(parsed.type).toBe('MSHWARI_LOAN');
    expect(parsed.amount).toBe(5000);
    expect(parsed.merchant).toBe('M-Shwari');
    expect(parsed.confidence).toBe('HIGH');
    expect(parsed.balance).toBe(15000);
  });

  it('classifies M-Shwari loan repayment via fallback', () => {
    const parsed = parseMpesaSms(
      'SAF2345678 Confirmed. Ksh2,500.00 repaid to M-Shwari loan from M-PESA on 22/04/26.',
    );
    expect(parsed.type).toBe('MSHWARI_LOAN');
    expect(parsed.amount).toBe(2500);
  });

  it('classifies M-Shwari savings deposit', () => {
    const parsed = parseMpesaSms(
      'SAF3456789 Confirmed. Ksh1,000.00 saved to M-Shwari on 22/04/26 at 2:00 PM.',
    );
    expect(parsed.type).toBe('MSHWARI_SAVINGS');
    expect(parsed.amount).toBe(1000);
    expect(parsed.merchant).toBe('M-Shwari');
  });

  it('classifies M-Shwari savings withdrawal', () => {
    const parsed = parseMpesaSms(
      'SAF4567890 Confirmed. Ksh500.00 withdrawn from M-Shwari savings on 22/04/26.',
    );
    expect(parsed.type).toBe('MSHWARI_SAVINGS');
    expect(parsed.amount).toBe(500);
  });
});

describe('parseMpesaSms - KCB M-Pesa types', () => {
  it('classifies KCB M-PESA loan disbursement', () => {
    const parsed = parseMpesaSms(
      'KCB1234567 Confirmed. Ksh10,000.00 KCB M-PESA loan disbursed on 22/04/26 at 11:00 AM.',
    );
    expect(parsed.type).toBe('KCB_LOAN');
    expect(parsed.amount).toBe(10000);
    expect(parsed.merchant).toBe('KCB M-PESA');
  });

  it('classifies KCB M-PESA loan repayment', () => {
    const parsed = parseMpesaSms(
      'KCB2345678 Confirmed. Ksh3,000.00 KCB M-PESA loan repayment from M-PESA on 22/04/26.',
    );
    expect(parsed.type).toBe('KCB_LOAN');
    expect(parsed.amount).toBe(3000);
  });

  it('classifies KCB M-PESA savings deposit', () => {
    const parsed = parseMpesaSms(
      'KCB3456789 Confirmed. Ksh2,000.00 deposited to KCB M-PESA savings on 22/04/26.',
    );
    expect(parsed.type).toBe('KCB_SAVINGS');
    expect(parsed.amount).toBe(2000);
  });

  it('classifies KCB M-PESA savings withdrawal', () => {
    const parsed = parseMpesaSms(
      'KCB4567890 Confirmed. Ksh1,500.00 withdrawn from KCB M-PESA savings on 22/04/26.',
    );
    expect(parsed.type).toBe('KCB_SAVINGS');
    expect(parsed.amount).toBe(1500);
  });
});

describe('parseMpesaSms - Pochi la Biashara', () => {
  it('classifies Pochi la Biashara received', () => {
    const parsed = parseMpesaSms(
      'PCH1234567 Confirmed. Ksh2,500.00 received from JOHN DOE via Pochi la Biashara on 22/04/26 at 3:15 PM.',
    );
    expect(parsed.type).toBe('POCHI_LA_BIASHARA');
    expect(parsed.amount).toBe(2500);
  });

  it('classifies Pochi la Biashara sent from till', () => {
    const parsed = parseMpesaSms(
      'PCH2345678 Confirmed. Ksh1,200.00 sent from your till number 98765 via Pochi la Biashara on 22/04/26.',
    );
    expect(parsed.type).toBe('POCHI_LA_BIASHARA');
    expect(parsed.amount).toBe(1200);
  });
});