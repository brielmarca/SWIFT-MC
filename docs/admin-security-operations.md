# SwiftMC — Operações de segurança administrativa (P2.3)

> Documento operacional. **Nunca incluir senhas, tokens, segredos, chaves privadas ou valores de `AUTH_ENCRYPTION_KEY` em registros, tickets ou capturas.**

## 1) Provisionar o primeiro OWNER

### Princípios
- Sem cadastro público, sem endpoint/UI de bootstrap, sem credenciais fixas/senha universal, sem autoatribuição.
- Provisionamento inicial de OWNER é **procedimento operacional controlado em ambiente confiável** (DB/admin direto), não ação self-service da aplicação.
- Vínculo à identidade exata autorizada: **Discord provider subject (ID imutável)**. Claim de uso único, auditável, atômico e protegido por triggers/constraints.
- Se já existir OWNER, não criar outro OWNER.
- Antes de concluir MFA, a conta não acessa dados/operações administrativas.

### Procedimento
1. **Autorização e pré-check (fora da aplicação):** aprovar titular e Discord ID exato; confirmar backup/snapshot e que não há OWNER ativo nem allowlist OWNER consumível indevida; planejar janela controlada.
2. **Criar provisionamento pendente (DB controlado):** inserir em `ProvisionedAdmin` registro com `discordSubject` autorizado, `targetRole='OWNER'`, `claimedByUserId/claimedAt/consumedAt` nulos, metadados operacionais mínimos (`note` sem segredos) conforme política interna. Executar com revisão dupla; não usar endpoints da aplicação. Não habilitar/expor `app.allow_owner_role` pela aplicação.
3. **Autenticação e claim:** titular autentica via Discord correspondente. O sistema consome claim uma única vez (concorrência/imutabilidade protegidas), atribui papel OWNER e incrementa `authVersion`; emite sessão **sem `mfaVerifiedAt`** e sem acesso admin utilizável.
4. **Configuração MFA restrita:** acessar `/admin/security` (fluxo restrito para conta admin-capaz ativa) → iniciar setup (segredo TOTP gerado no servidor, cifrado) → confirmar TOTP → salvar recovery codes de uso único (exibidos uma vez) em local seguro offline.
5. **Elevação segura:** concluir desafio MFA em `/admin/login` → sessão rotacionada com MFA validado.
6. **Validação:** verificar acesso mínimo necessário, auditoria, ausência de allowlists indevidas, e que o provisionamento não pode ser reutilizado.

## 2) Configurar MFA
1. Autenticar conta SwiftMC autorizada.
2. Ir para `/admin/security` (conta administrativa sem elevação pode configurar MFA, sem acesso a operações admin sensíveis).
3. Iniciar configuração: registrar URI/segredo no autenticador compatível TOTP (segredo gerado no servidor; não reutilizar entre contas).
4. Confirmar com código TOTP válido antes da ativação.
5. Armazenar recovery codes (hash-only no servidor, uso único, exibição única) offline.
6. Validar elevação em `/admin/login` quando necessário para operações administrativas.

**Notas:** setup pendente expira; desafios são single-use com limites de tentativa/expiração/anti-replay; falhas de infraestrutura devem ser tratadas como indisponibilidade segura (sem elevação).

## 3) Recuperar acesso administrativo
### OWNER único sem autenticadores (sem backdoor permanente)
1. Verificação forte de identidade do titular por processo operacional externo.
2. Em ambiente controlado com backup: revogar todas sessões, invalidar/rotacionar estado de autenticação conforme necessário (`authVersion`/revogação), e remover estado MFA comprometido/perdido **sem conceder acesso administrativo pré-MFA**.
3. Reabrir caminho controlado para configuração MFA (procedimento autorizado, auditado) exigindo nova configuração + confirmação TOTP + recovery codes antes de qualquer elevação.
4. Após recuperação: revisar auditoria, confirmar permissões, rotacionar materiais de recuperação, registrar lições aprendidas.

> Não usar credenciais fixas, bypass de MFA, endpoints públicos, nem `app.allow_owner_role` pela aplicação.

## 4) Revogar permissões
- **Imediato:** revogar sessões do usuário, incrementar `authVersion` e ajustar papel por procedimento autorizado compatível com guards DB (mudanças sensíveis server-side/auditadas). Claims de provisionamento são imutáveis/uso único; revogação de acesso não deve reabrir claim consumido.
- **Desativar MFA:** apenas via fluxo protegido (`/admin/security` + desafio `DISABLE` + reautenticação segura + MFA válido) com revogação de sessões e auditoria. Sessões comuns não podem desativar MFA administrativo.
- **Provisionamento pendente:** remover/invalidar apenas por operação controlada e auditada conforme política, sem criar caminho de escalada.

## 5) Verificar as migrações
- Conferir `_prisma_migrations` e ordem histórica (ver `docs/auth-admin-migrations-audit.md`).
- `npm run db:migrate:status` com `DIRECT_DATABASE_URL` direto (nunca Hyperdrive).
- Revisar SQL de migrações pendentes (`20261112120000_mfa_admin_hardening`, `20261112130000_admin_provisioning_hardening`) contra estado atual antes de aplicar.
- **Não modificar** migrações já aplicadas; correções apenas por migração incremental.

## 6) Validar a integridade do banco
- Em base descartável/staging: aplicar histórico completo; verificar FKs, uniques, checks, triggers (`auth_mfa_credential_guard`, `auth_provisioned_admin_claim_guard`, `auth_user_role_guard`), imutabilidade de claims, consumo único de challenges/recovery codes, expirações e `authVersion`.
- Testar concorrência: claim duplicado/simultâneo, replay de challenge, reuso de recovery code, segundo OWNER bloqueado.
- Confirmar ausência de perda de credenciais MFA/contas admin existentes e compatibilidade EMAIL_PASSWORD/DISCORD.

## 7) Reverter uma implantação de forma segura
- **Antes/deploy controlado:** snapshot/backup verificado e janela de rollback definida.
- **Falha durante migração:** confiar em atomicidade transacional quando aplicável; não forçar estado parcial.
- **Rollback preferencial:** restaurar backup/snapshot + alinhar versão da aplicação compatível com schema.
- Evitar `DROP`/remoção destrutiva de objetos de segurança; usar migração forward revisada para correções.
- Não aplicar migrações em staging compartilhado/produção sem autorização explícita.

## 8) Identificar tentativas de escalada de privilégios
- Monitorar `AuthAuditEvent` e logs: falhas MFA/challenge repetidas, `CSRF_REJECTED`/`ORIGIN_REJECTED`, rate-limit, claims negados, `ADMIN_ELEVATION_GRANTED` anômalos, `MFA_DISABLED`, mudanças de papel/sessões.
- Alertas de DB/app: erros `User role mutation is restricted`, `Owner already exists`, `ProvisionedAdmin claim is immutable`, tentativas de reuso de subject/claim, acessos 401/403 em `/admin*` e `/api/admin/*`.
- Revisões periódicas: exatamente 1 OWNER (quando aplicável), allowlists pendentes/consumidas, sessões privilegiadas ativas, contagem de recovery codes, integridade de identidades vinculadas.
