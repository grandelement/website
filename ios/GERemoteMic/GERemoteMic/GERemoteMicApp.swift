import SwiftUI

@main
struct GERemoteMicApp: App {
    @StateObject private var controller = RemoteMicController()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(controller)
                .task { await controller.start() }
        }
    }
}
