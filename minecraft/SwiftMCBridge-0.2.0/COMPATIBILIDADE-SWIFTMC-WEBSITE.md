# Compatibilidade Swift MC website (Next.js/Cloudflare/PostgreSQL/Stripe)

O site Swift MC implementa os endpoints do contrato do plugin em `/v1/bridge/*` e usa o site como fonte autoritativa de pagamento/entitlement.

## Endpoints implementados (compatíveis com o plugin)
- `POST /v1/bridge/link` — body `{ serverId, playerUuid, nickname, code }`, header `X-Swift-Server`, `Authorization: Bearer <MINECRAFT_BRIDGE_SECRET>`. Retorna `{ accountId }`.
- `GET /v1/bridge/pending` — retorna `{ deliveries:[{ deliveryId, accountId, playerUuid, kind, action, vip, cashAmount, expiresAt, sequence }] }` (apenas VIP; Cash desativado).
- `POST /v1/bridge/ack` — body `{ serverId, deliveryId, status:"completed", sequence }`. Idempotente: ACK duplicado do mesmo delivery/sequence retorna sucesso.

## Adaptações em relação ao backend Python de referência
- Não usa SQLite, catálogo Stripe no backend do bridge nem webhook Stripe próprio do bridge. A compra é verificada pelo webhook Stripe existente do site (`/api/webhooks/stripe`), reconciliada com API Stripe server-side e gravada em transação.
- Entregas VIP são criadas apenas para pedidos Stripe verificados, aprovados, com usuário autenticado e rank VIP (`swift|eclipse|cosmic|overdrive`). `expiresAt` é absoluto (30 dias a partir do pagamento verificado).
- Reembolso Stripe (`charge.refunded`, validado) revoga entitlements ativos do pedido e gera snapshot VIP `REMOVE`/estado final pendente. Entregas ACKed não são “desaplicadas” automaticamente pelo site; o estado final no LuckPerms vem do snapshot absoluto entregue pelo plugin (idempotente por journal local).
- Vínculo usa modelo existente `MinecraftIdentity` (1 conta site ↔ 1 UUID por namespace). Códigos `/link` são single-use, hash SHA-256, TTL 15 minutos, consumo atômico; bloqueia hijack/relink não autorizado.
- `cashAmount` é sempre `0` e entregas Cash não são geradas.

## Alteração feita no plugin fornecido (compatibilidade)
Arquivo: `plugin/src/main/java/br/com/swiftmc/bridge/Backend.java`
- ACK idempotente: HTTP `409` em `acknowledge` passa a ser tratado como confirmação duplicada, evitando falha de polling após retry/restart quando o site já confirmou o ACK. Isso preserva a semântica idempotente do journal durável do plugin.

Nenhuma mudança de protocolo foi necessária para `/link`, `/pending` ou payload de ACK (`status`, `serverId`, `sequence`).

## Observações de segurança/operação
- Nunca expor Stripe/DB para o Minecraft. Apenas `MINECRAFT_BRIDGE_SECRET` + `X-Swift-Server` autenticam o bridge.
- O JAR atual foi compilado com dependências reais (ver `BUILD.md`), mas **não foi homologado em servidor real** e não é production-ready. Validar em servidor Paper 1.21.11/Java 21 antes de qualquer deploy.
- O site é autoritativo para pagamento/VIP; o plugin apenas aplica estado final absoluto recebido da API.
