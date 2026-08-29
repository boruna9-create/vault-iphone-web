import SwiftUI

@main
struct VaultApp: App {
    @StateObject private var store = VaultStore()
    var body: some Scene {
        WindowGroup { ContentView().environmentObject(store).task { store.load() } }
    }
}
