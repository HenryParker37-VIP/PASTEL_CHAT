import Foundation
import AVFoundation
import CallKit
import Capacitor

private final class PastelCallManager: NSObject, CXProviderDelegate {
    static let shared = PastelCallManager()

    weak var plugin: PastelCallKitPlugin?
    private let callController = CXCallController()
    private var provider: CXProvider?
    private(set) var currentUUID: UUID?
    private var outgoingUUID: UUID?
    private var audioSessionIsActive = false

    private override init() {
        super.init()
        configureProvider()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func attach(plugin: PastelCallKitPlugin) {
        self.plugin = plugin
    }

    private func configureProvider() {
        let configuration = CXProviderConfiguration(localizedName: "Pastel Chat")
        configuration.supportsVideo = true
        configuration.maximumCallsPerCallGroup = 1
        configuration.maximumCallGroups = 1
        configuration.includesCallsInRecents = false

        let provider = CXProvider(configuration: configuration)
        provider.setDelegate(self, queue: nil)
        self.provider = provider
    }

    private func uuid(from call: CAPPluginCall) -> UUID {
        if let value = call.getString("uuid"), let parsed = UUID(uuidString: value) {
            return parsed
        }
        return UUID()
    }

    private func emit(_ action: String, uuid: UUID? = nil, extra: [String: Any] = [:]) {
        var payload = extra
        payload["action"] = action
        if let uuid { payload["uuid"] = uuid.uuidString }
        DispatchQueue.main.async { [weak self] in
            self?.plugin?.notifyListeners("callKitAction", data: payload)
        }
    }

    func startOutgoing(_ call: CAPPluginCall) {
        let callUUID = uuid(from: call)
        let handle = call.getString("handle") ?? "Pastel Chat"
        let displayName = call.getString("displayName")
        let hasVideo = call.getBool("hasVideo") ?? false

        if currentUUID != nil {
            call.reject("A call is already active", "CALL_IN_PROGRESS")
            return
        }

        currentUUID = callUUID
        outgoingUUID = callUUID
        let action = CXStartCallAction(call: callUUID, handle: CXHandle(type: .generic, value: handle))
        action.isVideo = hasVideo
        let transaction = CXTransaction(action: action)
        callController.request(transaction) { [weak self] error in
            DispatchQueue.main.async {
                if let error {
                    self?.currentUUID = nil
                    self?.outgoingUUID = nil
                    call.reject("Unable to start CallKit call: \(error.localizedDescription)", "CALLKIT_START_FAILED")
                    return
                }
                call.resolve(["uuid": callUUID.uuidString])
                self?.emit("startOutgoing", uuid: callUUID, extra: ["displayName": displayName ?? ""])
            }
        }
    }

    func reportIncoming(_ call: CAPPluginCall) {
        let callUUID = uuid(from: call)
        let handle = call.getString("handle") ?? "Pastel Chat"
        let displayName = call.getString("displayName") ?? handle
        let hasVideo = call.getBool("hasVideo") ?? false

        if currentUUID != nil {
            call.resolve(["reported": false, "reason": "call_in_progress"])
            return
        }

        currentUUID = callUUID
        outgoingUUID = nil
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: handle)
        update.localizedCallerName = displayName
        update.hasVideo = hasVideo
        update.supportsDTMF = false
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false

        provider?.reportNewIncomingCall(with: callUUID, update: update) { [weak self] error in
            DispatchQueue.main.async {
                if let error {
                    self?.currentUUID = nil
                    call.resolve(["reported": false, "reason": error.localizedDescription])
                    return
                }
                call.resolve(["reported": true, "uuid": callUUID.uuidString])
                self?.emit("incomingReported", uuid: callUUID)
            }
        }
    }

    func reportConnected(_ call: CAPPluginCall) {
        let callUUID = uuid(from: call)
        if outgoingUUID == callUUID {
            provider?.reportOutgoingCall(with: callUUID, connectedAt: Date())
        }
        call.resolve()
    }

    func reportEnded(_ call: CAPPluginCall) {
        let callUUID = uuid(from: call)
        let reason = endedReason(call.getString("reason"))
        provider?.reportCall(with: callUUID, endedAt: Date(), reason: reason)
        if currentUUID == callUUID { currentUUID = nil }
        if outgoingUUID == callUUID { outgoingUUID = nil }
        deactivateAudioSession()
        call.resolve()
    }

    func setMuted(_ call: CAPPluginCall) {
        guard let callUUID = currentUUID else {
            call.resolve()
            return
        }
        let muted = call.getBool("muted") ?? false
        let action = CXSetMutedCallAction(call: callUUID, muted: muted)
        callController.request(CXTransaction(action: action)) { error in
            if let error {
                call.reject("Unable to synchronize mute state", "CALLKIT_MUTE_FAILED", error)
            } else {
                call.resolve()
            }
        }
    }

    func setSpeaker(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? true
        do {
            try AVAudioSession.sharedInstance().overrideOutputAudioPort(enabled ? .speaker : .none)
            call.resolve()
        } catch {
            call.reject("Unable to change audio route", "AUDIO_ROUTE_FAILED", error)
        }
    }

    func activateAudio(_ call: CAPPluginCall) {
        do {
            try activateAudioSession()
            call.resolve()
        } catch {
            call.reject("Unable to activate call audio", "AUDIO_SESSION_FAILED", error)
        }
    }

    func deactivateAudio(_ call: CAPPluginCall) {
        deactivateAudioSession()
        call.resolve()
    }

    func requestEnd(_ call: CAPPluginCall) {
        guard let callUUID = currentUUID else {
            call.resolve()
            return
        }
        let action = CXEndCallAction(call: callUUID)
        callController.request(CXTransaction(action: action)) { error in
            if let error {
                call.reject("Unable to end CallKit call: \(error.localizedDescription)", "CALLKIT_END_FAILED")
            } else {
                call.resolve()
            }
        }
    }

    private func activateAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
        try session.setActive(true, options: [])
        audioSessionIsActive = true
    }

    private func deactivateAudioSession() {
        guard audioSessionIsActive else { return }
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            print("[CallKit] Audio session deactivation failed: \(error)")
        }
        audioSessionIsActive = false
    }

    private func endedReason(_ value: String?) -> CXCallEndedReason {
        switch value {
        case "failed": return .failed
        case "remote": return .remoteEnded
        case "declined": return .declinedElsewhere
        case "unanswered": return .unanswered
        default: return .remoteEnded
        }
    }

    // MARK: CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        let uuid = currentUUID
        currentUUID = nil
        outgoingUUID = nil
        deactivateAudioSession()
        emit("reset", uuid: uuid)
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: Date())
        action.fulfill()
        emit("startOutgoing", uuid: action.callUUID)
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        action.fulfill()
        emit("answer", uuid: action.callUUID)
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        action.fulfill()
        if currentUUID == action.callUUID { currentUUID = nil }
        if outgoingUUID == action.callUUID { outgoingUUID = nil }
        deactivateAudioSession()
        emit("end", uuid: action.callUUID)
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        action.fulfill()
        emit("mute", uuid: action.callUUID, extra: ["muted": action.isMuted])
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        audioSessionIsActive = true
        emit("audioActivated", uuid: currentUUID)
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        audioSessionIsActive = false
        emit("audioDeactivated", uuid: currentUUID)
    }

    @objc private func handleAudioInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }

        if type == .began {
            emit("audioInterrupted", uuid: currentUUID)
        } else if type == .ended, currentUUID != nil {
            do {
                try activateAudioSession()
                emit("audioResumed", uuid: currentUUID)
            } catch {
                print("[CallKit] Audio session resume failed: \(error)")
            }
        }
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        let route = AVAudioSession.sharedInstance().currentRoute.outputs.map { $0.portType.rawValue }
        emit("routeChanged", uuid: currentUUID, extra: ["outputs": route])
    }
}

@objc(PastelCallKitPlugin)
public final class PastelCallKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PastelCallKitPlugin"
    public let jsName = "PastelCallKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startOutgoingCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportIncomingCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportConnected", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportEnded", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMuted", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeaker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activateAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivateAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestEnd", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        PastelCallManager.shared.attach(plugin: self)
    }

    @objc func startOutgoingCall(_ call: CAPPluginCall) {
        PastelCallManager.shared.startOutgoing(call)
    }

    @objc func reportIncomingCall(_ call: CAPPluginCall) {
        PastelCallManager.shared.reportIncoming(call)
    }

    @objc func reportConnected(_ call: CAPPluginCall) {
        PastelCallManager.shared.reportConnected(call)
    }

    @objc func reportEnded(_ call: CAPPluginCall) {
        PastelCallManager.shared.reportEnded(call)
    }

    @objc func setMuted(_ call: CAPPluginCall) {
        PastelCallManager.shared.setMuted(call)
    }

    @objc func setSpeaker(_ call: CAPPluginCall) {
        PastelCallManager.shared.setSpeaker(call)
    }

    @objc func activateAudio(_ call: CAPPluginCall) {
        PastelCallManager.shared.activateAudio(call)
    }

    @objc func deactivateAudio(_ call: CAPPluginCall) {
        PastelCallManager.shared.deactivateAudio(call)
    }

    @objc func requestEnd(_ call: CAPPluginCall) {
        PastelCallManager.shared.requestEnd(call)
    }
}
