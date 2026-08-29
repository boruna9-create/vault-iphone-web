import SwiftUI
import AVKit

struct ContentView: View {
    @EnvironmentObject var store: VaultStore
    @State private var link = ""
    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Paste a supported video link", text:$link).textInputAutocapitalization(.never).keyboardType(.URL)
                    Button(store.downloading ? "Downloading…" : "Download to Vault") { Task { await store.download(link) } }.disabled(store.downloading || link.isEmpty)
                    if store.downloading { ProgressView() }
                }
                Section("My Vault") {
                    if store.videos.isEmpty { Text("Your Vault is empty").foregroundStyle(.secondary) }
                    ForEach(store.videos) { video in
                        NavigationLink(video.title) { PlayerView(video:video) }
                    }.onDelete { offsets in offsets.map{store.videos[$0]}.forEach(store.delete) }
                }
            }
            .navigationTitle("Vault")
            .alert("Vault", isPresented: Binding(get:{store.error != nil}, set:{if !$0 {store.error=nil}})) { Button("OK"){} } message:{ Text(store.error ?? "") }
        }
    }
}

struct PlayerView: View {
    @EnvironmentObject var store: VaultStore
    let video: VaultVideo
    var body: some View {
        VStack(spacing:16) {
            VideoPlayer(player: AVPlayer(url:store.url(for:video))).aspectRatio(16/9,contentMode:.fit).background(.black)
            Text(video.title).font(.headline)
            Text(ByteCountFormatter.string(fromByteCount:video.bytes,countStyle:.file)).foregroundStyle(.secondary)
            ShareLink(item:store.url(for:video)) { Label("Save / Share",systemImage:"square.and.arrow.up") }.buttonStyle(.borderedProminent)
            Spacer()
        }.navigationTitle("Video").navigationBarTitleDisplayMode(.inline)
    }
}
