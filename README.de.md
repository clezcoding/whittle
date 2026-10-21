<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/banner-light.svg">
    <img alt="Whittle: Schäl deinen Mac auf das herunter, was du nutzt." src="assets/readme/banner-dark.svg" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/clezcoding/whittle/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/clezcoding/whittle/ci.yml?branch=main&label=CI&style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
  <a href="https://github.com/clezcoding/whittle/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://img.shields.io/github/actions/workflow/status/clezcoding/whittle/codeql.yml?branch=main&label=CodeQL&style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/clezcoding/whittle"><img alt="OpenSSF Scorecard" src="https://api.scorecard.dev/projects/github.com/clezcoding/whittle/badge"></a>
  <a href="https://github.com/clezcoding/whittle/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/clezcoding/whittle?include_prereleases&style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
  <a href="https://github.com/clezcoding/whittle/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/clezcoding/whittle/total?label=Downloads&style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
  <a href="https://github.com/clezcoding/whittle/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/clezcoding/whittle?style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
</p>

<p align="center">
  <img alt="macOS 11+" src="https://img.shields.io/badge/macOS-11%2B-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae&logo=apple&logoColor=white">
  <img alt="Universal binary" src="https://img.shields.io/badge/Apple_Silicon_%2B_Intel-universal-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae">
  <img alt="Rust core" src="https://img.shields.io/badge/Rust-core-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae&logo=rust&logoColor=white">
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae&logo=tauri&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae&logo=react&logoColor=white">
  <a href="https://github.com/clezcoding/homebrew-tap"><img alt="Homebrew tap" src="https://img.shields.io/badge/Homebrew-tap-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae&logo=homebrew&logoColor=white"></a>
  <a href="LICENSE-MIT"><img alt="License: MIT or Apache-2.0" src="https://img.shields.io/badge/Lizenz-MIT_oder_Apache--2.0-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
</p>

<p align="center">
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
  <a href="#sicherheit-ist-das-produkt"><img alt="telemetry keine" src="https://img.shields.io/badge/telemetry-keine-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
  <a href="https://github.com/clezcoding/whittle/pulls?q=is%3Apr+author%3Aapp%2Fdependabot"><img alt="Dependabot on" src="https://img.shields.io/badge/Dependabot-on-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae&logo=dependabot&logoColor=white"></a>
  <a href="https://kodiakhq.com"><img alt="merged by Kodiak" src="https://img.shields.io/badge/merged_by-Kodiak-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae"></a>
  <a href=".pre-commit-config.yaml"><img alt="pre-commit enabled" src="https://img.shields.io/badge/pre--commit-enabled-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae&logo=pre-commit&logoColor=white"></a>
  <a href=".github/workflows"><img alt="actions per SHA gepinnt" src="https://img.shields.io/badge/actions-per_SHA_gepinnt-0e1012?style=flat-square&labelColor=0e1012&color=e8d2ae&logo=githubactions&logoColor=white"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <b>Deutsch</b>
</p>

<p align="center">
  <b>Ein Schweizer Taschenmesser für deinen Mac.</b><br>
  Whittle findet, was deinstallierte Apps zurückgelassen haben, räumt Caches und Build-Ordner weg,<br>
  die sich von selbst neu aufbauen, und sortiert unordentliche Ordner. Nichts wird gelöscht, ohne dass es einen Weg zurück gibt.
</p>

<p align="center">
  <a href="https://github.com/clezcoding/whittle/releases/latest"><b>⬇ Für macOS herunterladen</b></a> &nbsp;·&nbsp; <a href="#homebrew">Homebrew</a> &nbsp;·&nbsp; <a href="#die-kommandozeile">CLI</a> &nbsp;·&nbsp; <a href="#aus-dem-quelltext">Aus dem Quelltext</a>
</p>

```sh
brew tap clezcoding/tap
brew install --cask clezcoding/tap/whittle
```

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/overview-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/overview-light.png">
    <img alt="Whittles Übersicht: 35,3 GB können weg, 31,6 GB davon sicher" src="docs/screenshots/overview-dark.png" width="860">
  </picture>
</p>

> **Status: 0.1, früh.** Kern, Kommandozeile und App funktionieren und sind getestet. Die App ist aber noch nicht mit einer Apple-Developer-ID signiert. Den einmaligen Schritt dafür findest du unter [Installation](#installation). Rückmeldungen und Fehlerberichte sind sehr willkommen.

---

## Inhalt

[Was es kann](#was-es-kann) · [Live ansehen](#live-ansehen) · [Sicherheit](#sicherheit-ist-das-produkt) · [Die App](#die-app) · [Die Kommandozeile](#die-kommandozeile) · [Installation](#installation) · [Einstellungen](#einstellungen) · [Regeln](#regeln-sind-daten-kein-code) · [FAQ](#faq) · [Roadmap](#roadmap) · [Wie das Projekt läuft](#wie-das-projekt-läuft) · [Mitmachen](#mitmachen)

| **Immer rückgängig** | **Kein Netzwerk** | **Keine Rätsel** | **Regeln sind Daten** |
|---|---|---|---|
| Aufräumen verschiebt in eine Quarantäne. Ein Befehl oder ein Klick holt alles zurück. | Keine Telemetrie, kein Konto, keine Update-Prüfung. Die App darf keine Anfrage stellen. | Jeder Fund sagt, was er ist, warum er gelistet wird und was passiert, wenn er weg ist. | Wo Whittle sucht, steht in YAML. Ein neuer Cache-Ort ist ein Eintrag, kein Rust. |

## Was es kann

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/modules-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/modules-light.svg">
    <img alt="Fünf Module: Caches und Logs, Dev-Projekte, App-Reste, Duplikate, Ordner aufräumen" src="assets/readme/modules-dark.svg" width="100%">
  </picture>
</p>

| | Findet | Typische Größe |
|---|---|---|
| **Caches & Logs** | App-Caches, alte Logs und Absturzberichte, Xcode DerivedData, Device Support und Archive, Simulator-Caches, Homebrew-, npm-, yarn-, pnpm-, pip-, CocoaPods-, Cargo-, Go- und Gradle-Caches, liegengebliebene Installer im Download-Ordner, alte iPhone-Backups | 5 bis 40 GB |
| **Dev-Projekte** | `node_modules`, `target`, `.venv`, `build` und ähnliche Ordner von Projekten, die du länger nicht angefasst hast | 2 bis 30 GB |
| **App-Reste** | Support-Dateien, Caches, Einstellungen und kaputte LaunchAgents von Apps, die nicht mehr installiert sind. Installierte Apps werden aus fünf Quellen erkannt, nicht nur aus `/Applications` | 0,5 bis 10 GB |
| **Duplikate** *(optional)* | Identische Dateien in Downloads, Dokumente, Bilder. Erst nach Größe, dann per schnellem Hash, dann per vollem Hash | variiert |
| **Ordner aufräumen** | Sortiert lose Dateien in Downloads oder Schreibtisch nach Typ und Datum in Unterordner. Screenshots kommen nach Monat, auch mit deutschen und anderen lokalisierten Namen | kein Platz, nur Ordnung |

Jeder Fund kommt mit einer Erklärung in klaren Worten: *was es ist, warum es gelistet wird, was passiert, wenn du es entfernst, und ob Whittle es zurückholen kann*. Kein Eintrag bleibt ein Rätsel.

Das Risiko ist ein Wort und eine Form, nie nur eine Farbe:

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/risk-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/risk-light.svg">
    <img alt="Risikostufen: sicher, prüfen, manuell" src="assets/readme/risk-dark.svg" width="100%">
  </picture>
</p>

| | Bedeutung | Vorausgewählt? |
|---|---|---|
| ● **Sicher** | Entsteht von selbst neu (Caches, Build-Ordner). | Ja |
| ◐ **Prüfen** | Wahrscheinlich unnötig, etwa Daten einer deinstallierten App. | Nein |
| ○ **Manuell** | Nur du weißt es (Geräte-Backups, Ordner, die Whittle nicht einordnen kann). Zählt nicht in die Schlagzeile. | Nein |

## Live ansehen

Ein Scan liest, misst und erklärt. Nichts bewegt sich, bis du *Aufräumen* drückst, und *Rückgängig* holt es zurück. (Beispielzahlen; die Grafik läuft in einer Schleife und respektiert „Bewegung reduzieren“.)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/scan-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/scan-light.svg">
    <img alt="Ein Scan findet 35,3 GB, Aufräumen verschiebt 31,6 GB in die Quarantäne, Rückgängig holt sie zurück" src="assets/readme/scan-dark.svg" width="100%">
  </picture>
</p>

## Sicherheit ist das Produkt

Ein Aufräumprogramm ist nur so gut wie sein schlechtester Tag. Whittle ist so gebaut, dass ein Fehler in einer Regel nicht deinen Tag ruinieren kann.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/flow-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/flow-light.svg">
    <img alt="Scannen, prüfen, aufräumen, rückgängig machen" src="assets/readme/flow-dark.svg" width="100%">
  </picture>
</p>

- **Standardmäßig Quarantäne.** *Aufräumen* verschiebt Einträge nach `~/.whittle/quarantine/` und behält sie 30 Tage (einstellbar von 1 bis 365). `whittle undo` oder ein Klick in der App holt sie zurück. Papierkorb und endgültiges Löschen sind ausdrückliche Entscheidungen.
- **Vorschau, bevor etwas passiert.** `scan` ändert nichts. `clean --dry-run` zeigt den Plan. Die App fragt vor dem Aufräumen nach, und immer vor dem endgültigen Löschen.
- **Eine Verweigerungsschicht unter jeder Aktion.** Systempfade, dein Home-Ordner samt seinen Hauptordnern, Daten anderer Nutzer, `.git`-Ordner, echte `.app`-Bundles, Schlüsselbund, Mail, Fotos und iCloud-Daten werden verweigert, egal was eine Regel sagt. Deine eigene *Nie anfassen*-Liste wird an derselben Stelle durchgesetzt.
- **Die App schickt nie Pfade zum Löschen.** Die Oberfläche schickt IDs von Funden des letzten Scans. Das Rust-Backend schlägt die Pfade selbst nach. Selbst eine gekaperte Web-Ansicht kann also nur auf Gefundenes zugreifen.
- **Journal, das nur wächst.** Jede Änderung steht in `~/.whittle/journal.jsonl`.
- **Kein Netzwerk, keine Telemetrie, kein Konto.** Die Content-Security-Policy der App verbietet Netzwerkanfragen. Whittle spricht nie mit dem Internet.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/layers-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/layers-light.svg">
    <img alt="Regel, Sicherheitsschicht, Plan, Journal, Quarantäne" src="assets/readme/layers-dark.svg" width="100%">
  </picture>
</p>

## Die App

Whittles Oberfläche ist ein Fenster im macOS-Look, gebaut mit [Tauri](https://tauri.app) (Rust-Backend, React-Frontend). Sie zeigt gemessenen Fortschritt, nie einen Fake-Spinner: Prozent, vergangene Sekunden und Restzeit, je Modul.

<table>
  <tr>
    <td width="50%"><img alt="Prüfen: jeder Eintrag mit Begründung" src="docs/screenshots/review-dark.png"><br><sub><b>Prüfen.</b> Jeder Eintrag mit Begründung und den Folgen des Entfernens. An- und abwählen oder <i>Nie wieder vorschlagen</i>.</sub></td>
    <td width="50%"><img alt="Einstellungen" src="docs/screenshots/settings-dark.png"><br><sub><b>Einstellungen.</b> Standardaktion, Quarantänedauer, Nie-anfassen-Liste, Design, Bewegung und ein Check für den Vollzugriff auf die Festplatte.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img alt="Verlauf mit Rückgängig" src="docs/screenshots/history-dark.png"><br><sub><b>Verlauf.</b> Jeder Lauf, rückgängig machbar, solange er in Quarantäne liegt.</sub></td>
    <td width="50%"><img alt="Helles Design" src="docs/screenshots/overview-light.png"><br><sub><b>Hell und dunkel.</b> Folgt macOS oder wähle selbst. „Bewegung reduzieren“ wird respektiert.</sub></td>
  </tr>
</table>

Tastatur: `⌘R` scannen · `⌘1` bis `⌘4` Ansichten · `⌘,` Einstellungen · `?` alle Kürzel.

*Hinweis:* Die App-Oberfläche ist derzeit englisch. Die Erklärungen zu jedem Fund ebenso. Eine deutsche Oberfläche steht auf der [Roadmap](docs/ROADMAP.md).

## Die Kommandozeile

Dieselbe Engine, ohne Fenster. Alles ist ein Probelauf, bis du etwas anderes sagst.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/terminal-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/terminal-light.svg">
    <img alt="Eine Terminal-Sitzung: whittle scan, whittle clean, whittle undo" src="assets/readme/terminal-dark.svg" width="100%">
  </picture>
</p>

<details>
<summary><b>Alle Befehle</b></summary>

```sh
whittle scan                      # was könnte weg? (ändert nichts)
whittle scan --module orphans     # ein Modul: caches, projects, orphans, dupes
whittle scan --json               # maschinenlesbar
whittle clean --dry-run           # Plan anzeigen
whittle clean                     # sichere Einträge in die Quarantäne, mit Rückfrage
whittle clean --risk caution      # wahrscheinliche Reste einschließen
whittle undo                      # letzten Lauf zurückholen
whittle history                   # was Whittle geändert hat
whittle purge                     # Quarantäne endgültig leeren
whittle tidy ~/Downloads          # Sortierung als Vorschau
whittle tidy ~/Downloads --apply  # ausführen
whittle ignore ~/Developer/keep   # diesen Pfad nie melden oder anfassen (gilt auch in der App)
whittle apps                      # welche installierten Apps Whittle erkennt
whittle rules                     # eingebaute Regeln auflisten
```

</details>

## Installation

### Homebrew

```sh
brew tap clezcoding/tap

brew install --cask clezcoding/tap/whittle    # die App
brew install --formula clezcoding/tap/whittle # nur die Kommandozeile
```

### Download

Lade das universelle `.dmg` (Apple Silicon und Intel, macOS 11 oder neuer) vom [neuesten Release](https://github.com/clezcoding/whittle/releases/latest) und ziehe *Whittle* in *Programme*.

> **Erster Start.** Solange die App nicht mit einer Apple-Developer-ID signiert ist, meldet macOS *„Whittle kann nicht geöffnet werden“*. Das ist Gatekeeper, kein Fehler. Rechtsklick auf die App, **Öffnen**, dann noch einmal **Öffnen**. Oder einmalig im Terminal:
> ```sh
> xattr -dr com.apple.quarantine /Applications/Whittle.app
> ```
> Der Homebrew-Cask erledigt das für dich. Jedes Release listet seine SHA-256-Prüfsummen, damit du den Download prüfen kannst.

### Aus dem Quelltext

Du brauchst die Xcode-Kommandozeilentools, [Rust](https://rustup.rs), Node 20+ und pnpm.

```sh
git clone https://github.com/clezcoding/whittle
cd whittle
./scripts/install-mac.sh      # oder doppelklicke "Install Whittle.command"
```

Das baut `Whittle.app`, kopiert sie nach `/Applications`, installiert den Befehl `whittle` und öffnet die App. `--dmg` behält ein Disk-Image, `--no-cli` lässt den Befehl weg.

### Vollzugriff auf die Festplatte (optional)

macOS versteckt einige Ordner (Mail, Nachrichten, Safari) vor jeder App. Damit Whittle auch dort Reste findet, füge es unter *Systemeinstellungen, Datenschutz & Sicherheit, Vollständiger Festplattenzugriff* hinzu. Die Einführung beim ersten Start und die Einstellungsseite prüfen das für dich. Ohne den Zugriff funktioniert Whittle und überspringt, was es nicht lesen kann. Es entfernt deswegen nie mehr.

## Einstellungen

App und Kommandozeile teilen sich eine Datei: `~/.config/whittle/settings.json`. Jede Einstellung gilt sofort. Eine beschädigte Datei fällt auf die Standardwerte zurück und bleibt als `settings.json.broken` erhalten.

<details>
<summary><b>Alle Einstellungen</b></summary>

| Einstellung | Standard | Wirkung |
|---|---|---|
| Standardaktion | Quarantäne | Was *Aufräumen* tut: Quarantäne, Papierkorb oder sofort löschen |
| Vor dem Aufräumen fragen | an | Ein Zusammenfassungsdialog, bevor etwas verschoben wird |
| Entfernte Einträge behalten | 30 Tage | 1 bis 365 |
| Abgelaufene automatisch löschen | an | Wird beim Öffnen der App geprüft |
| Nie anfassen | leer | Pfade, die nie gelistet und nie verändert werden |
| Standardmäßig scannen | Caches, Projekte, App-Reste | Duplikate sind optional, weil sie viel lesen |
| Design, Bewegung | System | Dunkel, hell, reduzierte Bewegung |

</details>

## Regeln sind Daten, kein Code

Wo Whittle sucht, steht in YAML. Ein neuer Cache-Ort ist ein Eintrag und ein Pull Request, kein Rust nötig. Siehe [`rules/README.md`](rules/README.md). Private Regeln liegen in `~/.config/whittle/rules/*.yaml`. Eine Regel mit derselben `id` überschreibt die eingebaute.

```yaml
rules:
  - id: xcode-derived-data
    name: Xcode DerivedData
    category: dev
    risk: safe
    regenerable: true
    note: Build products and indexes. Xcode rebuilds them.
    paths: ["~/Library/Developer/Xcode/DerivedData/*"]
    min_age_days: 7
    platform: macos
```

## FAQ

<details>
<summary><b>Ist es sicher?</b></summary>

Es ist um genau diese Frage herum gebaut: siehe [Sicherheit](#sicherheit-ist-das-produkt). Trotzdem: Lies die Liste, bevor du auf *Aufräumen* drückst, und halte Backups bereit. Kein Werkzeug kennt jede Datei, die dir wichtig ist.

</details>

<details>
<summary><b>Warum werden Daten einer App gelistet, obwohl sie installiert ist?</b></summary>

Das sollte nicht passieren. Whittle prüft `/Applications`, Homebrew, Spotlight, Installer-Belege und eingebettete Helfer und liest App-Group-Entitlements. Findest du einen Fehlalarm, wähle *Nie wieder vorschlagen* und [eröffne bitte ein Issue](https://github.com/clezcoding/whittle/issues/new/choose) mit der Ausgabe von `whittle apps`.

</details>

<details>
<summary><b>Macht es meinen Mac schneller?</b></summary>

Nicht so, wie „Optimizer“-Apps es versprechen. Es schafft Speicherplatz und räumt auf. Es berührt den Arbeitsspeicher nicht und ist kein Virenscanner.

</details>

<details>
<summary><b>Telefoniert es nach Hause?</b></summary>

Nein. Es gibt keinen Netzwerkcode, keine Analytics, keine Update-Prüfung. Updates kommen von GitHub Releases oder Homebrew, wenn du sie willst.

</details>

<details>
<summary><b>Warum ist die App nicht signiert?</b></summary>

Signieren und Notarisieren braucht eine kostenpflichtige Apple-Developer-ID. Das steht auf der [Roadmap](docs/ROADMAP.md). Bis dahin gilt der Hinweis zum ersten Start oben.

</details>

<details>
<summary><b>Intel-Macs?</b></summary>

Ja. Releases sind Universal-Binaries.

</details>


## Roadmap

| | |
|---|---|
| ✅ **Fertig (0.1)** | Kern-Engine, Kommandozeile, Desktop-App, Quarantäne und Rückgängig, Homebrew-Tap, universelles DMG, Prüfsummen |
| 🔜 **Als Nächstes** | Signierte und notarisierte Releases, ein pnpm-Migrator für npm-Projekte, deutsche Oberfläche |
| 🧭 **Später** | Docker- und Runtime-Audit, Port-Inspektor, geplante stille Scans |

Details und Gründe: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Projektstruktur

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/arch-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/arch-light.svg">
    <img alt="Regeln speisen whittle-core, das Kommandozeile und Tauri-App gemeinsam nutzen" src="assets/readme/arch-dark.svg" width="100%">
  </picture>
</p>

```
crates/whittle-core   scannen, planen, anwenden, rückgängig, Sicherheitsschicht, Einstellungen (ohne UI)
crates/whittle-cli    der Befehl `whittle`
apps/gui              Tauri-v2- + React-App (src-tauri ist die dünne Rust-Hülle)
rules/                eingebaute Regeln als YAML
packaging/            Vorlagen für Homebrew-Formel und -Cask
assets/               Logo, Icon und README-Grafiken
docs/                 Designsystem, Architektur, Roadmap, Screenshots
```

[ARCHITECTURE](docs/ARCHITECTURE.md) · [DESIGN](docs/DESIGN.md) · [ROADMAP](docs/ROADMAP.md) · [CHANGELOG](CHANGELOG.md)

## Wie das Projekt läuft

Whittle entsteht offen und geht mit der eigenen Lieferkette so sorgfältig um wie mit deinen Dateien.

| | |
|---|---|
| **Ein Pflicht-Check** | *CI passed* schützt `main`. Pull Requests, die nur Doku ändern, überspringen die schweren Jobs. Code-Änderungen führen Rust (macOS und Linux), die Oberfläche, die Desktop-Hülle, Lizenzen und Advisories und ein echtes `.app`-Bundle parallel aus, in etwa drei Minuten. |
| **Automerge** | [Kodiak](https://kodiakhq.com) mergt einen Pull Request mit dem Label `automerge` per Squash, sobald die CI grün ist. Dependabot-Patch- und Minor-Updates bekommen das Label selbst. Majors und Tauri-Updates warten auf einen Menschen. Konfiguration: [`.kodiak.toml`](.kodiak.toml). |
| **Lieferkette** | Jede GitHub Action ist auf einen Commit-SHA gepinnt, Runner sind gehärtet, [CodeQL](.github/workflows/codeql.yml), [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/clezcoding/whittle), Dependency Review und `cargo deny` laufen bei jeder Änderung, und Dependabot hält alles aktuell. |
| **Releases** | Ein `v*`-Tag baut das universelle DMG und die Kommandozeilen-Archive, schreibt SHA-256-Summen und aktualisiert den Homebrew-Tap. Siehe [`docs/RELEASING.md`](docs/RELEASING.md). |
| **Labels** | Pull Requests werden anhand der geänderten Dateien beschriftet (`rust`, `frontend`, `tauri`, `rule`, `safety`, `security`, `ci`, `release`, `documentation` …), und die Release Notes werden danach gruppiert. |

## Mitmachen

Fehlerberichte, neue Regeln und Ideen helfen am meisten. Lies [CONTRIBUTING.md](CONTRIBUTING.md). Kurzfassung: `make check` führt aus, was die CI ausführt, und die Oberfläche läuft auch im normalen Browser mit Demodaten (`cd apps/gui && pnpm dev`). Sicherheitslücken bitte nach [SECURITY.md](SECURITY.md) melden und kein öffentliches Issue eröffnen.

## Name

To whittle heißt, ein Stück Holz Span für Span herunterzuschnitzen. Das Logo ist dieser Span, mit dem Schnitt in Rot.

## Lizenz

Doppelt lizenziert unter [MIT](LICENSE-MIT) oder [Apache-2.0](LICENSE-APACHE), nach deiner Wahl. Schriften: Switzer (Indian Type Foundry, über Fontshare) und Geist Mono (SIL OFL). Siehe [`docs/THIRD-PARTY-NOTICES.md`](docs/THIRD-PARTY-NOTICES.md).

<p align="center"><sub>Gemacht von <a href="https://github.com/clezcoding">clezcoding</a> by Puzzless Foundation und Mitwirkenden.</sub></p>
