package com.lifeos.sms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class LifeOsSmsModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val EVENT_SMS_RECEIVED = "LifeOsSmsReceived"
  }

  private var smsReceiver: BroadcastReceiver? = null
  private var listenerCount = 0

  override fun getName(): String = "LifeOsSmsModule"

  @ReactMethod
  fun addListener(eventName: String) {
    if (eventName == EVENT_SMS_RECEIVED) listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    listenerCount = maxOf(0, listenerCount - count)
  }

  @ReactMethod
  fun readMpesaInbox(limit: Int, promise: Promise) {
    if (!hasReadSmsPermission()) {
      promise.reject("E_PERMISSION", "READ_SMS permission not granted")
      return
    }

    try {
      val safeLimit = if (limit <= 0) 50 else minOf(limit, 500)
      val results = queryMpesaInbox(safeLimit)
      promise.resolve(results)
    } catch (error: Exception) {
      promise.reject("E_SMS_READ", error.message, error)
    }
  }

  @ReactMethod
  fun drainQueuedMpesaMessages(limit: Int, promise: Promise) {
    try {
      val drained = SmsQueueStore.drain(reactContext, limit)
      val payload = Arguments.createArray()
      for (message in drained) {
        payload.pushMap(toWritableMap(message))
      }
      promise.resolve(payload)
    } catch (error: Exception) {
      promise.reject("E_SMS_DRAIN", error.message, error)
    }
  }

  @ReactMethod
  fun startMpesaReceiver(promise: Promise) {
    if (!hasReceiveSmsPermission()) {
      promise.reject("E_PERMISSION", "RECEIVE_SMS permission not granted")
      return
    }

    if (smsReceiver != null) {
      promise.resolve(true)
      return
    }

    try {
      val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
      smsReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
          val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
          for (message in messages) {
            val body = message.messageBody ?: ""
            val address = message.originatingAddress ?: ""
            if (!looksLikeMpesa(body, address)) continue
            val timestamp = message.timestampMillis.toDouble()
            SmsQueueStore.enqueue(
              context = reactContext,
              body = body,
              address = address,
              timestamp = timestamp,
            )
            emitSms(body = body, address = address, timestamp = timestamp)
          }
        }
      }

      ContextCompat.registerReceiver(
        reactContext,
        smsReceiver,
        filter,
        ContextCompat.RECEIVER_NOT_EXPORTED,
      )
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_SMS_RECEIVER", error.message, error)
    }
  }

  @ReactMethod
  fun stopMpesaReceiver(promise: Promise) {
    try {
      smsReceiver?.let { reactContext.unregisterReceiver(it) }
      smsReceiver = null
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_SMS_RECEIVER_STOP", error.message, error)
    }
  }

  private fun hasReadSmsPermission(): Boolean {
    return ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.READ_SMS,
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun hasReceiveSmsPermission(): Boolean {
    return ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.RECEIVE_SMS,
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun looksLikeMpesa(body: String?, address: String?): Boolean {
    val haystack = "${body.orEmpty()} ${address.orEmpty()}".uppercase()
    return haystack.contains("MPESA") || haystack.contains("M-PESA")
  }

  private fun queryMpesaInbox(limit: Int): WritableArray {
    val resolver: ContentResolver = reactContext.contentResolver
    val uri: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      Telephony.Sms.Inbox.CONTENT_URI
    } else {
      Uri.parse("content://sms/inbox")
    }

    val projection = arrayOf("body", "address", "date")
    val selection = "address LIKE ? OR body LIKE ?"
    val selectionArgs = arrayOf("%MPESA%", "%M-PESA%")
    val sortOrder = "date DESC LIMIT $limit"

    val cursor: Cursor? = resolver.query(uri, projection, selection, selectionArgs, sortOrder)
    val items = Arguments.createArray()

    cursor?.use {
      val bodyIndex = it.getColumnIndex("body")
      val addressIndex = it.getColumnIndex("address")
      val dateIndex = it.getColumnIndex("date")

      while (it.moveToNext()) {
        val item = Arguments.createMap()
        if (bodyIndex >= 0) item.putString("body", it.getString(bodyIndex) ?: "")
        if (addressIndex >= 0) item.putString("address", it.getString(addressIndex) ?: "")
        if (dateIndex >= 0) item.putDouble("timestamp", it.getLong(dateIndex).toDouble())
        items.pushMap(item)
      }
    }

    return items
  }

  private fun emitSms(body: String, address: String, timestamp: Double) {
    if (!reactContext.hasActiveCatalystInstance()) return
    if (listenerCount <= 0) return

    val payload = toWritableMap(QueuedSms(body = body, address = address, timestamp = timestamp))

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_SMS_RECEIVED, payload)
  }

  private fun toWritableMap(message: QueuedSms): WritableMap {
    return Arguments.createMap().apply {
      putString("body", message.body)
      putString("address", message.address)
      putDouble("timestamp", message.timestamp)
    }
  }
}
