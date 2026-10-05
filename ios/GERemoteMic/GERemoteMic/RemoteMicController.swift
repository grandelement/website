import Foundation
import AVFAudio
import AVFoundation
import UIKit

@MainActor
final class RemoteMicController: ObservableObject {
    @Published var paired = false
    @Published var remoteReady = false
    @Published var onAir = false
    @Published var muted = false
    @Published var level: Double = 1.0
    @Published var peak: Double = 0
    @Published var status = "NOT PAIRED"
    @Published var lastError = ""

    private var credentials: DeviceCredentials?
    private let engine = AVAudioEngine()
    private let streamer = PCMStreamer()
    private var heartbeatTask: Task<Void, Never>?
    private var tapInstalled = false
    private var autoReady = UserDefaults.standard.bool(forKey: "GERemoteReadyDefault")

    func start() async {
        credentials = CredentialsStore.load()
        paired = credentials != nil
        status = paired ? "PAIRED" : "NOT PAIRED"
        if paired {
            autoReady = true
            UserDefaults.standard.set(true, forKey: "GERemoteReadyDefault")
            try? await setRemoteReady(true)
        }
        startHeartbeat()
    }

    func pair(code: String) async throws {
        let model = UIDevice.current.model
        let name = UIDevice.current.name
        let creds = try await RadioAPI.shared.claim(code: code, name: name, model: model, capabilities: mediaCapabilities())
        CredentialsStore.save(creds)
        credentials = creds
        paired = true
        status = "PAIRED"
        try await setRemoteReady(true)
        startHeartbeat()
    }

    func forgetDevice() async {
        await setAir(false)
        await setRemoteReady(false)
        CredentialsStore.clear()
        credentials = nil
        paired = false
        status = "NOT PAIRED"
    }

    func setRemoteReady(_ enabled: Bool) async throws {
        if enabled {
            let granted = await requestMicPermission()
            guard granted else { throw NSError(domain: "GE", code: 10, userInfo: [NSLocalizedDescriptionKey: "Microphone permission is required."]) }
            try configureAudio()
            try startEngine()
            remoteReady = true
            autoReady = true
            UserDefaults.standard.set(true, forKey: "GERemoteReadyDefault")
            UIApplication.shared.isIdleTimerDisabled = true
            status = "CONNECTED"
        } else {
            await setAir(false)
            engine.stop()
            if tapInstalled {
                engine.inputNode.removeTap(onBus: 0)
                tapInstalled = false
            }
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            remoteReady = false
            autoReady = false
            UserDefaults.standard.set(false, forKey: "GERemoteReadyDefault")
            UIApplication.shared.isIdleTimerDisabled = false
            status = paired ? "DISCONNECTED" : "NOT PAIRED"
        }
    }

    func setAir(_ enabled: Bool) async {
        guard enabled != onAir else { return }
        guard let credentials else { return }
        if enabled {
            guard remoteReady else {
                lastError = "This device is not Remote Ready."
                return
            }
            do {
                let token = try await RadioAPI.shared.liveSession(device: credentials)
                streamer.connect(token: token)
                onAir = true
                status = "ON AIR"
                lastError = ""
            } catch {
                lastError = error.localizedDescription
                onAir = false
            }
        } else {
            streamer.disconnect()
            onAir = false
            if remoteReady { status = "CONNECTED" }
            await RadioAPI.shared.liveStop(device: credentials)
        }
    }

    private func cameraAvailable() -> Bool {
        AVCaptureDevice.default(for: .video) != nil
    }

    private func cameraPermissionState() -> String {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "not-requested"
        @unknown default: return "unknown"
        }
    }

    private func mediaCapabilities() -> [String] {
        var caps = ["audio", "microphone"]
        if cameraAvailable() { caps.append("camera") }
        return caps
    }

    private func requestMicPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    private func configureAudio() throws {
        let s = AVAudioSession.sharedInstance()
        try s.setCategory(.playAndRecord, mode: .measurement, options: [.allowBluetoothHFP, .mixWithOthers])
        try s.setPreferredSampleRate(48_000)
        try s.setPreferredIOBufferDuration(0.01)
        try s.setActive(true)
    }

    private func startEngine() throws {
        let input = engine.inputNode
        if !tapInstalled {
            let format = input.outputFormat(forBus: 0)
            input.installTap(onBus: 0, bufferSize: 960, format: format) { [weak self] buffer, _ in
                guard let self else { return }
                let p = Self.peakPercent(buffer)
                Task { @MainActor in self.peak = p }
                if self.onAir && !self.muted {
                    self.streamer.send(buffer, gain: self.level)
                }
            }
            tapInstalled = true
        }
        engine.prepare()
        try engine.start()
    }

    private func startHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                await self.heartbeatOnce()
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    private func heartbeatOnce() async {
        guard let credentials else { return }
        do {
            let appState: String = switch UIApplication.shared.applicationState {
            case .active: "foreground"
            case .background: "background"
            default: "inactive"
            }
            let result = try await RadioAPI.shared.heartbeat(device: credentials, payload: [
                "remote_ready": remoteReady,
                "mic_active": engine.isRunning,
                "on_air": onAir,
                "muted": muted,
                "level": level,
                "peak_pct": peak,
                "app_state": appState,
                "last_error": lastError,
                "capabilities": mediaCapabilities(),
                "camera_available": cameraAvailable(),
                "camera_permission": cameraPermissionState(),
                "video_transport": "not-built",
                "video_active": false,
                "video_error": ""
            ])
            for command in result.commands ?? [] {
                await handle(command)
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func handle(_ command: RemoteCommand) async {
        switch command.action {
        case "arm":
            if let v = command.value?.boolValue {
                do { try await setRemoteReady(v) } catch { lastError = error.localizedDescription }
            }
        case "air":
            if let v = command.value?.boolValue { await setAir(v) }
        case "mute":
            if let v = command.value?.boolValue { muted = v }
        case "level":
            if let v = command.value?.numberValue { level = max(0, min(1.5, v)) }
        case "stop":
            await setAir(false)
        case "ping":
            break
        default:
            break
        }
    }

    nonisolated private static func peakPercent(_ buffer: AVAudioPCMBuffer) -> Double {
        guard let channels = buffer.floatChannelData, buffer.frameLength > 0 else { return 0 }
        let ch = channels[0]
        var sum: Double = 0
        for i in 0..<Int(buffer.frameLength) {
            let x = Double(ch[i])
            sum += x * x
        }
        let rms = sqrt(sum / Double(buffer.frameLength))
        let db = max(-60.0, 20.0 * log10(max(rms, 0.000001)))
        return max(0, min(100, (db + 60.0) / 60.0 * 100.0))
    }
}
