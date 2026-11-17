# SwiftMCBridge 0.2.0 build (website-compatible)

Source of truth is `minecraft/SwiftMCBridge-0.2.0/` in this repository, originally preserved from the provided reference package at `/tmp/opencode/Swift MC-Bridge-0.2.0/plugin` (not overwritten). Includes ACK fix for Swift MC website contract: HTTP 409 on acknowledge is accepted **only** when the response confirms `{ok:true,duplicate:true}`; unrelated conflicts fail so the local journal is not falsely ACKed.

## Build environment (isolated, local)
- Java: Temurin/OpenJDK **21.0.13 LTS** (`/tmp/opencode/tools/jdk-21.0.13+9`)
- Maven: **Apache Maven 3.9.9** (`/tmp/opencode/tools/apache-maven-3.9.9`)
- OS: Linux x86_64 (this workspace)

## Real dependencies (not API stubs)
Resolved by Maven from official repos (network) and system jar:
- `io.papermc.paper:paper-api:1.21.11-R0.1-SNAPSHOT` (provided) — `repo.papermc.io`
- `net.luckperms:api:5.4` (provided) — `repo.lucko.me`
- `com.swiftmc:SwiftCash:0.2.0` (system) — `libs/SwiftCash-0.2.0.jar`
- Gson/HTTP/stdlib as resolved by Paper/compile classpath (`br.com.swiftmc.bridge.Backend` uses `com.google.gson`).

## Command
```bash
JAVA_HOME=/tmp/opencode/tools/jdk-21.0.13+9 \
/tmp/opencode/tools/apache-maven-3.9.9/bin/mvn -DskipTests clean package
```

## Outputs
- Module target: `minecraft/SwiftMCBridge-0.2.0/target/SwiftMCBridge-0.2.0.jar`
- Saved candidate: `minecraft/build-artifacts/SwiftMCBridge-0.2.0-realdeps.jar` (copy of target jar)

## Dependency provenance and reproducibility
- Paper API and LuckPerms resolve from their official repositories at build time; verify downloaded artifacts against the repositories' signatures if offline reproducibility is required.
- `libs/SwiftCash-0.2.0.jar` is a local system-scoped jar that is **not committed to Git** (ignored as an untrusted binary). No public distribution URL, upstream version tag or recorded checksum exists for it in this repository.
- Consequence: a fresh checkout **cannot** build the plugin until a reviewed `SwiftCash-0.2.0.jar` with a documented source and SHA-256 is provisioned into `libs/`. Do not trust or rebuild against an unverified copy.
- Reference hash of the current local jar (for identification only, not provenance): `8b74322aed2e4be2e36361767b7d596879267b223d75dfe0c024f07ca893a887`.

## Known runtime risks (requires real Paper/LuckPerms/SwiftCash staging)
- LuckPerms group names/hierarchy must exist (`swift,eclipse,cosmic,overdrive`).
- LuckPerms API failures throw and prevent ACK (by design); verify behavior under permission/user-load errors.
- Cash paths are gated/disabled for website integration but code remains; keep `softdepend: [SwiftCash]`.
- Polling uses background thread + Bukkit scheduler; validate reconnect/restart, offline players, and concurrent HTTP/poll timing on Paper 1.21.11.
- JAR integrity/signing not added; deploy only trusted artifacts.
