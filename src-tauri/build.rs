use std::path::Path;

/// The frontend is embedded into the binary by `tauri::generate_context!`, a **proc macro** — and a
/// proc macro cannot emit `cargo:rerun-if-changed`. `tauri_build::build()` emits those only for
/// `tauri.conf.json`, `capabilities/`, bundled resources and sidecars, so nothing in the build
/// graph mentions `frontendDist`.
///
/// The consequence is silent and expensive: change app code, run `npm run build:desktop`, and the
/// `beforeBuildCommand` re-exports `dist/` — but Cargo then sees no reason to recompile this crate,
/// so `generate_context!` is never re-expanded and the installer ships the **previous** frontend.
/// The app installs cleanly, reports the new version, and behaves like the old one. Reproduced
/// 2026-08-14: after editing `dist/index.html`, `cargo build --release` finished in 0.39s and left
/// the binary untouched.
///
/// It is invisible whenever anything else in the graph moves — a Rust edit, or the version bump a
/// release writes into `tauri.conf.json` — which is why releases usually looked fine and builds
/// between them did not.
const FRONTEND_DIST: &str = "../dist";

fn main() {
  // Cargo walks a directory path recursively, so this covers the hashed bundles and every asset.
  // Absent during `tauri dev` (which serves `devUrl` and embeds nothing) — emitting the directive
  // for a missing path would rebuild on every invocation.
  if Path::new(FRONTEND_DIST).exists() {
    println!("cargo:rerun-if-changed={FRONTEND_DIST}");
  }

  tauri_build::build()
}
