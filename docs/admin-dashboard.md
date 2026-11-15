# SwiftMC — Painel administrativo (staging)

## Escopo
- `/admin`: indicadores de contas, pedidos, VIPs ativos, processamentos e entregas Bridge pendentes, mais eventos recentes.
- `/admin/users`: usuários e status de verificação, paginação de 25 registros.
- `/admin/orders`: histórico de pedidos e pagamentos por status, paginação.
- `/admin/deliveries`: fila Bridge e status de entrega, **somente leitura**.
- `/admin/audit`: trilha de auditoria da autenticação, paginação.
- `/admin/security`: configuração e verificação MFA existente.
- `/admin/provisioning`: allowlist de outros ADMINs, restrita a OWNER.

## Controle de acesso
- Todas as páginas administrativas que exibem dados exigem sessão **ACTIVE**, permissão `audit:read` e **MFA elevado** por `requireAdminPage` (ou equivalente já existente em MFA/configuração).
- OWNER controla `security:configure` e provisionamento. Apenas usuários já autorizados conseguem abrir o painel.
- O e-mail de login é **identificador de contato**, nunca autoriza privilégios sozinho. Não há autoatribuição por e-mail, cadastro de OWNER na UI, bypass de MFA nem senha universal.
- O primeiro OWNER é provisionado operacionalmente e vinculado ao **Discord user ID imutável**, de acordo com `docs/admin-security-operations.md`. Após autenticar, exige configuração e confirmação de TOTP em `/admin/security`, seguida de elevação em `/admin/login`.
- As consultas de usuários, pedidos, entregas e auditoria são somente leitura. Não há alteração de saldo, confirmação forçada de entrega, reembolso ou mudança de cargo neste pacote.

## Operação
- As consultas usam o banco configurado pelo runtime protegido, não novas credenciais de frontend.
- Nenhuma migração de banco ou alteração no Minecraft Bridge é introduzida.
- O botão de acesso em `/account` aparece apenas para papéis com `audit:read`; a autorização real é verificada novamente em cada página no servidor.
- Dados pessoais da listagem de usuários devem ser usados apenas para operações autorizadas.
- Antes de promover para produção, revisar permissões, logs, ambientes e deploy de staging, conforme os procedimentos existentes.
