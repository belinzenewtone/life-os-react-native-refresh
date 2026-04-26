package com.lifeos.sms

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class QueuedSms(
  val body: String,
  val address: String,
  val timestamp: Double,
)

object SmsQueueStore {
  private const val PREFS_NAME = "lifeos_sms_queue"
  private const val KEY_ITEMS = "items"
  private const val MAX_ITEMS = 200

  fun enqueue(context: Context, body: String, address: String, timestamp: Double) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = readQueue(prefs.getString(KEY_ITEMS, null))
    val item = JSONObject().apply {
      put("body", body)
      put("address", address)
      put("timestamp", timestamp)
    }
    queue.put(item)

    while (queue.length() > MAX_ITEMS) {
      queue.remove(0)
    }

    prefs.edit().putString(KEY_ITEMS, queue.toString()).apply()
  }

  fun drain(context: Context, limit: Int): List<QueuedSms> {
    val safeLimit = if (limit <= 0) 50 else minOf(limit, MAX_ITEMS)
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val queue = readQueue(prefs.getString(KEY_ITEMS, null))

    val takeCount = minOf(safeLimit, queue.length())
    val drained = mutableListOf<QueuedSms>()
    for (index in 0 until takeCount) {
      val item = queue.optJSONObject(index) ?: continue
      drained.add(
        QueuedSms(
          body = item.optString("body", ""),
          address = item.optString("address", ""),
          timestamp = item.optDouble("timestamp", System.currentTimeMillis().toDouble()),
        ),
      )
    }

    val remaining = JSONArray()
    for (index in takeCount until queue.length()) {
      val item = queue.opt(index)
      if (item != null) {
        remaining.put(item)
      }
    }
    prefs.edit().putString(KEY_ITEMS, remaining.toString()).apply()

    return drained
  }

  private fun readQueue(raw: String?): JSONArray {
    if (raw.isNullOrBlank()) return JSONArray()
    return try {
      JSONArray(raw)
    } catch (_: Exception) {
      JSONArray()
    }
  }
}
