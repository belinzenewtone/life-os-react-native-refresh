package com.lifeos.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class MpesaSmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    if (context == null) return
    if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    for (message in messages) {
      val body = message.messageBody ?: ""
      val address = message.originatingAddress ?: ""
      if (!looksLikeMpesa(body, address)) continue
      SmsQueueStore.enqueue(
        context = context.applicationContext,
        body = body,
        address = address,
        timestamp = message.timestampMillis.toDouble(),
      )
    }
  }

  private fun looksLikeMpesa(body: String?, address: String?): Boolean {
    val haystack = "${body.orEmpty()} ${address.orEmpty()}".uppercase()
    return haystack.contains("MPESA") || haystack.contains("M-PESA")
  }
}
