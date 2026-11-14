# Auditoria de migrações — Auth/MFA/Admin (P2.3, rascunho em progresso)

Status: auditoria local do repositório em `audit/auth-hardening`. **Nenhuma migração aplicada/alterada em ambiente compartilhado ou produção.** Migrações existentes **não foram modificadas**.

## Escopo inspecionado
- `prisma/schema.prisma`
- `prisma/migrations/20261022000000_auth_persistence/migration.sql`
- `prisma/migrations/20261023000000_add_user_id_to_order/migration.sql`
- `prisma/migrations/20261105000000_add_login_lockout/migration.sql`
- `prisma/migrations/20261106000000_add_stripe_provider/migration.sql`
- `prisma/migrations/20261108203314_minecraft_bridge_vip_deliveries/migration.sql`
- `prisma/migrations/20261110120000_node_rate_limits/migration.sql`
- `prisma/migrations/20261110121000_cash_order_snapshot/migration.sql`
- `prisma/migrations/20261111120000_discord_oauth_mfa_admin/migration.sql`
- `prisma/migrations/20261111121000_account_settings_links_phone/migration.sql`
- `prisma/migrations/20261112120000_mfa_admin_hardening/migration.sql`

## Ordem de aplicação (histórico)
1. `20261003000000_persistence_foundation`
2. `20261003010000_add_order_rank_duration`
3. `20261003020000_add_mercado_pago_order_metadata`
4. `20261022000000_auth_persistence` — base auth (User/AuthIdentity/Session/BrowserContext/OAuthTransaction/EmailChallenge/MinecraftIdentity/AuthAuditEvent, enums, FKs, checks, triggers de imutabilidade de identidade/credencial email-password).
5. `20261023000000_add_user_id_to_order`
6. `20261105000000_add_login_lockout`
7. `20261106000000_add_stripe_provider`
8. `20261108203314_minecraft_bridge_vip_deliveries`
9. `20261110120000_node_rate_limits`
10. `20261110121000_cash_order_snapshot`
11. `20261111120000_discord_oauth_mfa_admin` — `ProvisionedAdmin`, `MfaCredential` inicial, guardas de claim/role/MFA (Discord-only em pontos críticos).
12. `20261111121000_account_settings_links_phone` — `User.phoneE164` e relaxamento controlado de mutação de `providerSubject` apenas para `EMAIL_PASSWORD` (necessário para troca de email verificada), preservando imutabilidade de provider/owner.
13. `20261112120000_mfa_admin_hardening` — `MfaSetup`, `MfaChallenge`, `MfaRecoveryCode`, extensão de `MfaCredential`, checks/índices; substitui `auth_mfa_credential_guard` para exigir **dono da identidade** (remove acoplamento Discord-only), mantendo integridade.

## Achados de compatibilidade e risco

### 1) `auth_mfa_credential_guard` (corrigido incrementalmente)
- **111 (antiga):** exigia `AuthIdentity.provider = DISCORD` → incompatível com MFA de contas EMAIL_PASSWORD/admins não-Discord.
- **121 (corretiva na sequência):** redefine função para validar existência da identidade e `ident_user = NEW.userId` (ownership), sem restringir provider. **Compatível** com EMAIL_PASSWORD e DISCORD.
- **Risco em banco já migrado até 111:** credenciais/fluxos MFA não-Discord falhariam até aplicar 121. **Não remover** 121; aplicar após 111.
- **Risco residual:** integridade depende de identidade pertencente ao usuário; aplicação deve vincular `identityId` a uma identidade real do usuário (setup atual seleciona primeira identidade existente). Contas sem identidade cadastrada não devem conseguir ativar MFA de forma insegura (fail-closed).

### 2) `ProvisionedAdmin` + `auth_provisioned_admin_claim_guard` + `auth_user_role_guard` (bloqueador estrutural)
- **111:** claim só pode ser consumido se existir `AuthIdentity` DISCORD com `providerSubject == discordSubject` e owner compatível; trigger promove usuário para **ADMIN** e torna claim imutável. `user_role_guard` permite mutação para ADMIN somente via claim válido; OWNER somente com `current_setting('app.allow_owner_role', true)='true'`.
- **Impactos:**
  - Não suporta provisionamento de **OWNER** de forma controlada/auditável pela aplicação.
  - Não suporta provisionamento vinculado a identidade EMAIL_PASSWORD (se exigido futuramente) — atualmente claim exige identidade Discord correspondente.
  - Bootstrap do primeiro OWNER não pode depender de flag de sessão/backdoor; `app.allow_owner_role` não deve ser exposta por endpoint público.
  - Concessão ocorre no momento do claim (update em callback Discord) e pode preceder conclusão de MFA na lógica de negócio; mitigado porque **todos acessos admin exigem MFA validado no servidor**, mas fluxo/estado de privilégio precisa permanecer seguro e auditável.
- **Concorrência:** claim único por `discordSubject`/`claimedByUserId`, update condicional na aplicação e trigger de imutabilidade reduzem corrida, mas falta modelagem explícita de alvo de cargo/status/reuso para bootstrap OWNER e prevenção formal “se já existe OWNER, bootstrap inicial não cria outro”.

### 3) Integridade referencial / constraints
- FKs principais com `ON DELETE RESTRICT` preservam contas e credenciais (sem perda acidental). `MfaChallenge.sessionId` usa `CASCADE` na deleção de sessão (adequado para artefatos efêmeros).
- Checks adicionados em 121 para não-vazio, expiração, tentativas e propósito de challenge/recovery/setup; `recoveryCode` único por hash global não existe (hash indexado), consumo é atômico por `updateMany where usedAt null`.
- `MfaCredential` mantém `identityId` único e `userId` único (1 credencial por usuário) — alinhado ao modelo atual; preserva credenciais existentes (`confirmedAt` backfill de `enabledAt`).

### 4) Alterações sensíveis de cargo / escalada
- Promoção automática para ADMIN no claim (111) é server-side no DB, porém acoplada a Discord e sem distinção OWNER/ADMIN.
- Sem migração corretiva adicional, criação segura do primeiro OWNER exige procedimento operacional controlado (não implementado).

### 5) Sessões e auth version
- Revogações/rotações implementadas em fluxos críticos (login, elevação MFA, troca de senha/reset, disable MFA), mas alterações de cargo administrativas futuras devem invalidar sessões (`bumpAuthVersion`/revogação) — necessário cobrir no provisionamento/gestão de papéis.

## Migrações corretivas necessárias (incrementais, sem editar históricas)
- **Nova migração planejada:** endurecer `ProvisionedAdmin` e guards para suportar bootstrap/provisionamento seguro controlado (alvo de papel, prevenção de reuso/conflito, compatibilidade com claim existente) **sem remover proteções** e sem assumir DB vazio. Detalhes e SQL corretivo: a definir na implementação em andamento.
- Não modificar `20261111120000_*` nem `20261112120000_*` se já aplicadas.

## Pré-requisitos de aplicação (staging/ambientes reais)
- Backup consistente antes de aplicar migrações pendentes.
- Confirmar versão/schema atual (`_prisma_migrations`) e se 111/121 já aplicadas.
- Garantir `AUTH_ENCRYPTION_KEY` e segredos operacionais configurados antes de fluxos MFA.
- Validar em base descartável/staging: ordem completa, triggers, claims concorrentes, MFA EMAIL_PASSWORD/DISCORD, rollback transacional por migração quando aplicável.

## Procedimento de rollback (alto nível)
- Migrações Prisma são forward-only; rollback seguro preferencial: restaurar backup/snapshot tomado antes da janela.
- Se falha durante aplicação de migração transacional PostgreSQL, transação é revertida automaticamente (nenhum estado parcial daquela migração).
- Reverter código da aplicação para versão compatível com schema vigente; **não** dropar tabelas/constraints de segurança sem migração forward revisada e plano de dados.
- Em incidente de provisionamento indevido: revogar sessões (`revokeAllUserSessions`/bump authVersion), ajustar papel por procedimento operacional auditado e revisar `AuthAuditEvent`/`ProvisionedAdmin`.

## Status
- Auditoria inicial concluída; correções estruturais de bootstrap/OWNER e endurecimento de guards **pendentes**.
