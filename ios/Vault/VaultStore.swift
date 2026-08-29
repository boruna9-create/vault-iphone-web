import Foundation

struct VaultVideo: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var filename: String
    var bytes: Int64
}

@MainActor
final class VaultStore: ObservableObject {
    @Published var videos: [VaultVideo] = []
    @Published var downloading = false
    @Published var progress: Double = 0
    @Published var error: String?
    private let backend = URL(string: "https://vault-iphone-web-6pm1.vercel.app/api/resolve")!

    private var folder: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let u = base.appendingPathComponent("Vault/Videos", isDirectory: true)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }
    private var index: URL { folder.deletingLastPathComponent().appendingPathComponent("library.json") }
    func url(for v: VaultVideo) -> URL { folder.appendingPathComponent(v.filename) }

    func load() {
        if let d = try? Data(contentsOf: index), let list = try? JSONDecoder().decode([VaultVideo].self, from: d) {
            videos = list.filter { FileManager.default.fileExists(atPath: url(for: $0).path) }
        }
    }
    private func save() { if let d = try? JSONEncoder().encode(videos) { try? d.write(to: index, options: .atomic) } }

    func download(_ raw: String) async {
        guard let source = URL(string: raw), ["http","https"].contains(source.scheme?.lowercased() ?? "") else { error = "Enter a valid link."; return }
        downloading = true; progress = 0; error = nil
        do {
            var req = URLRequest(url: backend)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["url": source.absoluteString])
            let (temp, response) = try await URLSession.shared.download(for: req)
            guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
            guard (200...299).contains(http.statusCode) else {
                let data = try Data(contentsOf: temp)
                let obj = try? JSONSerialization.jsonObject(with: data) as? [String:Any]
                throw NSError(domain: "Vault", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: obj?["error"] as? String ?? "Download failed"])
            }
            let attrs = try FileManager.default.attributesOfItem(atPath: temp.path)
            let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
            guard size > 0 else { throw NSError(domain:"Vault",code:1,userInfo:[NSLocalizedDescriptionKey:"The server returned an empty video."]) }
            let id = UUID(), filename = id.uuidString + ".mp4", dest = folder.appendingPathComponent(filename)
            try FileManager.default.moveItem(at: temp, to: dest)
            let header = http.value(forHTTPHeaderField: "X-Vault-Filename")?.removingPercentEncoding
            let title = header.map { URL(fileURLWithPath:$0).deletingPathExtension().lastPathComponent } ?? "Vault Video"
            videos.insert(VaultVideo(id:id,title:title,filename:filename,bytes:size), at:0); save(); progress = 1
        } catch { self.error = error.localizedDescription }
        downloading = false
    }
    func delete(_ v: VaultVideo) { try? FileManager.default.removeItem(at: url(for:v)); videos.removeAll{$0.id==v.id}; save() }
}
