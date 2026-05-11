/**
 * AppDelegate.swift - Pastel Chat iOS Configuration
 *
 * This file shows the required AppDelegate configuration for native features.
 * After Capacitor generates the iOS project, copy this configuration to:
 * ios/App/App/AppDelegate.swift
 *
 * It handles:
 * - Push notification registration
 * - Remote notification handling
 * - Background audio support
 * - VoIP/Call kit setup
 */

import UIKit
import Capacitor
import Firebase
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Firebase initialization
    FirebaseApp.configure()

    // Configure notification categories for call notifications
    let answerAction = UNNotificationAction(
      identifier: "answer",
      title: "Answer",
      options: [.foreground]
    )
    let declineAction = UNNotificationAction(
      identifier: "decline",
      title: "Decline",
      options: [.foreground]
    )

    let callCategory = UNNotificationCategory(
      identifier: "CALL_NOTIFICATION",
      actions: [answerAction, declineAction],
      intentIdentifiers: [],
      options: []
    )

    UNUserNotificationCenter.current().setNotificationCategories([callCategory])

    // Set notification delegate
    UNUserNotificationCenter.current().delegate = self

    return true
  }

  // MARK: - UISceneDelegate
  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let sceneConfig = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
    sceneConfig.delegateClass = SceneDelegate.self
    return sceneConfig
  }

  // MARK: - Remote Notification Handling
  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Handle background push notification
    print("[AppDelegate] Remote notification received in background")

    // Ensure app stays awake for processing
    completionHandler(.newData)
  }

  // MARK: - Push Notification Registration
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    // Handle notification when app is in foreground
    print("[UNNotificationCenter] Notification while foreground")

    let data = notification.request.content.userInfo
    print("[UNNotificationCenter] Data: \(data)")

    // Display notification while app is in foreground
    var options: UNNotificationPresentationOptions = [.banner, .sound, .badge]
    if #available(iOS 14.0, *) {
      options.insert(.list)
    }

    completionHandler(options)
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    // Handle user tapping on notification
    let data = response.notification.request.content.userInfo
    let actionId = response.actionIdentifier

    print("[UNNotificationCenter] Action: \(actionId), Data: \(data)")

    // Capacitor plugin handles this in JavaScript
    completionHandler()
  }
}

// MARK: - SceneDelegate
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  func sceneDidBecomeActive(_ scene: UIScene) {
    print("[SceneDelegate] App became active")

    // Resume audio if backgrounded during call
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playAndRecord, options: [.duckOthers, .defaultToSpeaker])
      try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      print("[SceneDelegate] Audio session error: \(error)")
    }
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    print("[SceneDelegate] App backgrounded")
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    // Handle notification when app is launched from notification
    if let userActivity = connectionOptions.userActivities.first {
      self.scene(scene, continue: userActivity)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    print("[SceneDelegate] Continuing activity: \(userActivity.activityType)")
  }
}

// MARK: - Audio Session Configuration
import AVFoundation

extension AppDelegate {
  func configureAudioSession() {
    do {
      let audioSession = AVAudioSession.sharedInstance()

      // Configure for call/VOIP apps
      try audioSession.setCategory(
        .playAndRecord,
        mode: .voiceChat,
        options: [
          .duckOthers,           // Lower other app audio when recording
          .defaultToSpeaker,     // Use speaker by default
          .allowAirPlay,         // Support AirPlay
          .allowBluetoothA2DP,   // Support Bluetooth headphones
          .allowBluetooth        // Support Bluetooth devices
        ]
      )

      try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
      print("[AudioSession] Configured for VoIP")
    } catch {
      print("[AudioSession] Configuration failed: \(error.localizedDescription)")
    }
  }
}
