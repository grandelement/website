import Foundation

struct PairClaimResponse: Decodable {
    let ok: Bool
    let device_id: String?
    let device_key: String?
    let error: String?
}

struct RemoteCommand: Decodable, Identifiable {
    let id: String
    let action: String
    let value: JSONValue?
}

struct HeartbeatResponse: Decodable {
    let ok: Bool
    let commands: [RemoteCommand]?
    let error: String?
}

struct LiveSessionResponse: Decodable {
    let ok: Bool
    let token: String?
    let error: String?
}

enum JSONValue: Decodable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([String: JSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }

    var boolValue: Bool? { if case .bool(let v) = self { return v }; return nil }
    var numberValue: Double? { if case .number(let v) = self { return v }; return nil }
    var stringValue: String? { if case .string(let v) = self { return v }; return nil }
}

final class RadioAPI {
    static let shared = RadioAPI()
    let baseURL = URL(string: "https://radio.grandelement.blitz.cloud")!

    private func request(path: String, method: String = "POST", body: [String: Any]? = nil, device: DeviceCredentials? = nil) throws -> URLRequest {
        var r = URLRequest(url: baseURL.appending(path: path))
        r.httpMethod = method
        r.timeoutInterval = 20
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let d = device {
            r.setValue(d.id, forHTTPHeaderField: "X-GE-Device-ID")
            r.setValue(d.key, forHTTPHeaderField: "X-GE-Device-Key")
        }
        if let body { r.httpBody = try JSONSerialization.data(withJSONObject: body) }
        return r
    }

    func claim(code: String, name: String, model: String, capabilities: [String]) async throws -> DeviceCredentials {
        let r = try request(path: "/control/device/pair/claim", body: [
            "code": code, "name": name, "platform": "ios", "model": model, "capabilities": capabilities
        ])
        let (data, response) = try await URLSession.shared.data(for: r)
        guard let http = response as? HTTPURLResponse, http.statusCode < 300 else {
            throw URLError(.userAuthenticationRequired)
        }
        let result = try JSONDecoder().decode(PairClaimResponse.self, from: data)
        guard result.ok, let id = result.device_id, let key = result.device_key else {
            throw NSError(domain: "GE", code: 1, userInfo: [NSLocalizedDescriptionKey: result.error ?? "Pairing failed."])
        }
        return DeviceCredentials(id: id, key: key)
    }

    func heartbeat(device: DeviceCredentials, payload: [String: Any]) async throws -> HeartbeatResponse {
        let r = try request(path: "/control/device/heartbeat", body: payload, device: device)
        let (data, _) = try await URLSession.shared.data(for: r)
        return try JSONDecoder().decode(HeartbeatResponse.self, from: data)
    }

    func liveSession(device: DeviceCredentials) async throws -> String {
        let r = try request(path: "/control/device/live-session", body: [:], device: device)
        let (data, response) = try await URLSession.shared.data(for: r)
        let result = try JSONDecoder().decode(LiveSessionResponse.self, from: data)
        guard let http = response as? HTTPURLResponse, http.statusCode < 300, result.ok, let token = result.token else {
            throw NSError(domain: "GE", code: 2, userInfo: [NSLocalizedDescriptionKey: result.error ?? "Could not start remote mic."])
        }
        return token
    }

    func liveStop(device: DeviceCredentials) async {
        guard let r = try? request(path: "/control/device/live-stop", body: [:], device: device) else { return }
        _ = try? await URLSession.shared.data(for: r)
    }
}
