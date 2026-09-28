import Foundation
import AVFAudio

final class PCMStreamer {
    private var socket: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .default)
    private let lock = NSLock()

    func connect(token: String) {
        disconnect()
        var c = URLComponents(string: "wss://radio.grandelement.blitz.cloud/control/live")!
        c.queryItems = [URLQueryItem(name: "token", value: token)]
        let ws = session.webSocketTask(with: c.url!)
        socket = ws
        ws.resume()
    }

    func disconnect() {
        lock.lock()
        let ws = socket
        socket = nil
        lock.unlock()
        ws?.cancel(with: .normalClosure, reason: nil)
    }

    func send(_ buffer: AVAudioPCMBuffer, gain: Double = 1.0) {
        guard let data = Self.int16Stereo48k(buffer, gain: gain) else { return }
        lock.lock()
        let ws = socket
        lock.unlock()
        ws?.send(.data(data)) { _ in }
    }

    private static func int16Stereo48k(_ input: AVAudioPCMBuffer, gain: Double) -> Data? {
        let inFormat = input.format
        guard let outFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48_000, channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: inFormat, to: outFormat) else { return nil }

        let ratio = 48_000.0 / max(1.0, inFormat.sampleRate)
        let capacity = AVAudioFrameCount(Double(input.frameLength) * ratio + 64)
        guard let out = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: capacity) else { return nil }

        var supplied = false
        var error: NSError?
        let status = converter.convert(to: out, error: &error) { _, outStatus in
            if supplied {
                outStatus.pointee = .noDataNow
                return nil
            }
            supplied = true
            outStatus.pointee = .haveData
            return input
        }
        guard status != .error, let ch = out.floatChannelData?[0] else { return nil }

        var samples = [Int16]()
        samples.reserveCapacity(Int(out.frameLength) * 2)
        for i in 0..<Int(out.frameLength) {
            let f = max(-1.0, min(1.0, Double(ch[i]) * gain))
            let v = Int16(max(-32768, min(32767, Int(f * 32767.0))))
            samples.append(v)
            samples.append(v)
        }
        return samples.withUnsafeBufferPointer { Data(buffer: $0) }
    }
}
