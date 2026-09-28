import SwiftUI

struct ContentView: View {
    @EnvironmentObject var controller: RemoteMicController
    @State private var pairingCode = ""
    @State private var busy = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Text("GE REMOTE MIC").font(.title2).bold()
                statusCard

                if controller.paired {
                    Toggle("REMOTE READY", isOn: Binding(
                        get: { controller.remoteReady },
                        set: { value in Task { try? await controller.setRemoteReady(value) } }
                    ))
                    .font(.headline)
                    .padding()
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))

                    VStack(alignment: .leading, spacing: 6) {
                        Text("MIC LEVEL").font(.caption).bold()
                        ProgressView(value: controller.peak, total: 100)
                            .scaleEffect(x: 1, y: 3, anchor: .center)
                    }
                    .padding(.vertical, 8)

                    Button(controller.onAir ? "STOP AIR" : "TEST AIR") {
                        Task { await controller.setAir(!controller.onAir) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(controller.onAir ? .red : .blue)
                    .controlSize(.large)

                    Text("When REMOTE READY is on, the microphone audio session stays active so the paired DJ booth can control this channel while iOS allows the background audio session to continue.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    if !controller.lastError.isEmpty {
                        Text(controller.lastError).font(.footnote).foregroundStyle(.red)
                    }

                    Spacer()
                    Button("FORGET THIS PAIRING", role: .destructive) {
                        Task { await controller.forgetDevice() }
                    }
                } else {
                    TextField("6 digit code", text: $pairingCode)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                        .font(.title3)
                        .multilineTextAlignment(.center)

                    Button("PAIR WITH DJ BOOTH") {
                        busy = true
                        Task {
                            defer { busy = false }
                            do { try await controller.pair(code: pairingCode) }
                            catch { controller.lastError = error.localizedDescription }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(pairingCode.count != 6 || busy)

                    Text("Create a pairing code from DJ → MIXER → CHANNELS → LINK DEVICE.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    if !controller.lastError.isEmpty {
                        Text(controller.lastError).font(.footnote).foregroundStyle(.red)
                    }
                    Spacer()
                }
            }
            .padding(22)
        }
    }

    private var statusCard: some View {
        HStack {
            Circle()
                .fill(controller.onAir ? Color.red : (controller.remoteReady ? Color.green : (controller.paired ? Color.yellow : Color.gray)))
                .frame(width: 14, height: 14)
            Text(controller.status).font(.headline)
            Spacer()
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }
}
