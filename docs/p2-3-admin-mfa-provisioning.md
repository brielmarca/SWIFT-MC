# P2.3 — Provisionamento administrativo, primeiro OWNER, MFA e migrações (rascunho operacional)

> Documento operacional para revisão/homologação. **Não inclui segredos, tokens, senhas ou credenciais reais.**  
> Status: P2.3 **não concluída**; mudanças locais em `audit/auth-hardening`, sem deploy e sem migrações aplicadas em staging/prod.

## 1. Estado atual (implementado neste branch)

### Controles preservados/reforçados
- P1 preservado: checks de origem/CSRF/fetch-metadata, rotação/invalidação de sessão em fluxos sensíveis existentes, `changePassword` transacional com rollback em estado parcial, reauth em operações sensíveis onde já implementado.
- Sessões admin: política 30min inatividade / 8h absoluto, sem remember-me privilegiado, elevação exige MFA real e rotaciona sessão (`mfaVerifiedAt` somente após verificação válida no fluxo de elevação).
- Guards server-side: páginas/APIs admin exigem usuário ativo + permissão necessária + sessão MFA válida (`requireMfa`), fail-closed.
- MFA: segredo TOTP gerado no servidor, cifrado com `AUTH_ENCRYPTION_KEY` (AES-256-GCM), setup pendente com expiração/confirmação, desafios single-use com expiração/tentativas, anti-replay por step, recovery codes de uso único armazenados por hash, desativação exige sessão elevada + desafio DISABLE + reautenticação sensível e revoga todas sessões.
- Provisionamento: endpoint/UI de provisionamento restrito a OWNER com `security:configure` + MFA; criação de ADMIN em allowlist (Discord subject) auditável; claim no callback Discord condicionado e protegido por update concorrência/trigger DB.

### Migrações (incrementais, não aplicadas)
- **Não modificar** migrações históricas potencialmente aplicadas (`20261111120000_discord_oauth_mfa_admin`, `20261112120000_mfa_admin_hardening`).
- `20261112120000_mfa_admin_hardening`: adiciona setup/challenge/recovery, estende credencial e substitui `auth_mfa_credential_guard` para validar **propriedade da identidade** (compatível EMAIL_PASSWORD/DISCORD), preservando integridade.
- `20261112130000_admin_provisioning_hardening` (**nova, corretiva**): adiciona `targetRole/grantedByUserId/consumedAt/note` em `ProvisionedAdmin`, endurece claim (imutável, uma vez, exige identidade Discord correspondente, impede segundo OWNER), faz grant de papel + `authVersion` bump atômico no claim, restringe `auth_user_role_guard` a claims válidos (mantém escape hatch operacional `app.allow_owner_role` **apenas** para procedimento DB controlado, nunca exposto por endpoint).

## 2. Compatibilidade de migrações, riscos e pré-requisitos

Ver auditoria detalhada: `docs/auth-admin-migrations-audit.md`.

- **Ordem:** aplicar histórico pendente em ordem; `20261112130000_admin_provisioning_hardening` após `20261111120000_discord_oauth_mfa_admin`.
- **DB não vazio:** esperado; não remover constraints/triggers sem substituto equivalente. Claims/privilégios existentes devem ser preservados.
- **Risco principal (pré-12130000 em produção):** claim antigo promovia apenas ADMIN e guardas eram Discord-acoplados em semântica de OWNER bootstrap; novo modelo requer validação em staging descartável.
- **Risco operacional:** usuários sem identidade elegível para vincular `MfaCredential.identityId` não conseguem concluir ativação (fail-closed) — revisar política de criação/vínculo de identidade para contas admin EMAIL_PASSWORD puras.
- **Pré-requisitos:** backup/snapshot, confirmação de `_prisma_migrations`, `AUTH_ENCRYPTION_KEY` (32 bytes), `APP_URL`/origem confiável, Hyperdrive/DB direto conforme ambiente, testes em base isolada.

## 3. Primeiro OWNER — procedimento seguro (operacional controlado)

### Regras
- Nenhum cadastro público, API pública, UI self-service, senha universal, credencial fixa ou autoatribuição de cargo.
- Se já existir OWNER, bootstrap inicial **não** cria outro OWNER (enforçado por trigger/condição).
- Claim é de uso único e vinculado ao **Discord subject (ID imutável do provedor)** autorizado; concessão auditável.
- Antes de concluir MFA, a conta **não** acessa dados/operações administrativas (guards server-side exigem MFA válido; sessão privilegiada emitida sem `mfaVerifiedAt`).

### Fluxo recomendado (ambiente confiável, operador autorizado)
1. **Autorização operacional:** aprovar identidade alvo fora da aplicação pública (processo interno). Identificar conta SwiftMC autorizada e seu Discord ID (subject) exato.
2. **Pré-check:** confirmar que não existe OWNER ativo (consulta administrativa/DB em ambiente controlado) e que o Discord ID não foi consumido.
3. **Provisionamento inicial controlado (DB/migração operacional, não endpoint):** em janela controlada com backup, inserir/ajustar registro em `ProvisionedAdmin` com `discordSubject` autorizado e `targetRole='OWNER'` (único, pendente) via acesso administrativo ao banco **somente** por operador autorizado e canal seguro. *Não* usar `app.allow_owner_role` via aplicação; se for estritamente necessário um ajuste emergencial de schema/estado, usar transação auditada com revisão dupla e reverter flag de sessão imediatamente. Registrar evidência operacional (quem, quando, motivo, identificador) — sem segredos.
4. **Autenticação normal:** usuário autorizado autentica com Discord correspondente (claim exige identidade Discord matching). Callback tenta claim atômico; em sucesso, DB atribui papel OWNER e incrementa `authVersion` (invalidação lógica). Sessão emitida **sem MFA verificado** e sem acesso admin.
5. **Configuração MFA restrita:** acessar `/admin/security` (acesso limitado a conta admin-capaz ativa para configurar MFA) → iniciar setup (segredo server-generated, cifrado) → confirmar TOTP válido → receber recovery codes **uma única vez**.
6. **Elevação segura:** acessar `/admin/login`, concluir desafio MFA → sessão rotacionada com `mfaVerifiedAt` válido.
7. **Validação pós-bootstrap:** confirmar permissões mínimas, revisar auditoria, revogar sessões antigas se necessário, armazenar recovery codes offline, remover/desabilitar artefatos operacionais temporários. Nunca reutilizar provisionamento consumido.

### Recuperação de acesso (único OWNER sem autenticadores)
- **Não criar backdoor permanente, credencial fixa, endpoint público ou bypass de MFA.**
- Procedimento operacional de emergência (controlado): verificar identidade do titular por processo forte fora do app; em ambiente com backup/janela, operador autorizado pode (a) revogar sessões e invalidar credenciais MFA comprometidas, (b) criar estado controlado para reconfiguração MFA **sem conceder acesso administrativo pré-validação**, ou (c) restaurar acesso via ação transacional/auditada no DB conforme política interna — sempre exigindo nova configuração+confirmação MFA antes de qualquer operação admin.
- Após recuperação: rotacionar segredos de sessão (`authVersion`/revogação), regenerar recovery codes, revisar `AuthAuditEvent`, endurecer causa raiz.

## 4. MFA e identidades (diretrizes aplicadas)

- MFA pertence à conta SwiftMC; segredo não fornecido pelo cliente; criptografia em repouso via `AUTH_ENCRYPTION_KEY`.
- Setup expira (10 min) e só ativa após confirmação TOTP válida; desafios expiram/limitam tentativas/consumo único; recovery codes hash + uso único atômico.
- Disable exige desafio MFA + reautenticação sensível e revoga sessões.
- Contas ADMIN/OWNER sem MFA: painel admin bloqueado por guardas MFA; fluxo deve direcionar para configuração/elevation segura.
- Identidades EMAIL_PASSWORD/DISCORD/mistas: claim/provisionamento atual vinculado a Discord subject (decisão de segurança existente); MFA de credencial agora compatível em nível de ownership de identidade (migração 121) — validar em DB real.

## 5. Sessões e elevação

- Absoluto 8h, inatividade 30min para privilegiados; `mfaVerifiedAt` dentro de janela configurada para operações que exigem MFA.
- Rotação em elevação/desativação MFA e em eventos sensíveis cobertos; mudanças de cargo via claim fazem bump de `authVersion` (12130000) para invalidar sessões existentes.
- Proteções: origem/fetch-metadata/CSRF em mutações, rate limiting em endpoints MFA/auth sensíveis, cookies `__Host-*` HttpOnly/Secure/SameSite conforme implementação existente.

## 6. Verificação de migrações e integridade (sem aplicar em prod)

- Status: `npm run db:migrate:status` (requer `DIRECT_DATABASE_URL` direto; não usar Hyperdrive).
- Validar schema: `npx prisma validate`, `npx prisma generate`.
- Em base local/staging descartável: aplicar histórico completo, verificar triggers/constraints, simular claim concorrente, MFA para EMAIL_PASSWORD e DISCORD, expiração/consumo único, revogação de sessão, integridade de FKs, e ausência de promoção indevida de papel.
- `npm run test:db` exige PostgreSQL descartável (`initdb/pg_ctl/createdb` ou modo remoto dedicado) — **não disponível** neste ambiente; não executado.

## 7. Rollback seguro

- Preferir restore de backup/snapshot pré-janela. Migrações transacionais falham atomicamente.
- Nunca editar migrações já aplicadas; correções via migração forward incremental.
- Em rollback de código, manter schema compatível ou aplicar plano forward revisado; não dropar objetos de segurança sem análise de dados.

## 8. Detecção de tentativas de escalada de privilégios

- Monitorar `AuthAuditEvent`: falhas repetidas MFA/challenge, `ORIGIN_REJECTED`/CSRF/rate-limit, claims negados, mudanças inesperadas de papel, revogações em massa, disable MFA, logins privilegiados sem elevação concluída.
- Alertar para: criação/consumo de `ProvisionedAdmin`, erros de trigger `User role mutation is restricted`/`Owner already exists`, múltiplas tentativas de claim para mesmo subject, acessos 403/401 em `/admin*` e `/api/admin/*`.
- Revisões periódicas: allowlist pendente/consumida, contagem de OWNER=1, sessões ativas privilegiadas, credenciais MFA/recovery codes restantes.
