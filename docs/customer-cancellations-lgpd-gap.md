# SwiftMC — Cancelamentos, cookies e LGPD: escopo desta entrega

## Implementado
- `/account/orders`: botão **Solicitar cancelamento** para pedidos autenticados elegíveis.
- `POST /api/user/orders/[orderNumber]/cancel`: autorização por sessão e proprietário do pedido, checagem de origem + CSRF, motivo opcional limitado a 800 caracteres, idempotência por pedido, gravação durável de `OrderCancellationRequest`.
- `/admin/cancellations`: lista protegida para acompanhar solicitações, e indicador no dashboard.
- `/cookies`: descrição do armazenamento do navegador e das categorias de consentimento.
- Botão **Cookies** global: rejeitar opcionais por padrão, aceitar, personalizar e rever escolha a qualquer momento. O site **não instala rastreadores opcionais nesta versão**. Qualquer inclusão futura exige verificar o consentimento antes de carregar a integração.
- `/privacy`: aviso inicial com informações verificáveis e pendências destacadas.
- `/refund`: fluxo de solicitação e referência ao CDC, sem prometer estorno automático.

## Não implementado — não afirmar conclusão
- O botão registra uma **solicitação**, NÃO executa cancelamento do provedor, estorno, reversão do acesso Minecraft ou interrupção definitiva da cobrança. Operadores devem analisar o pedido, o CDC e os pagamentos no Stripe/Mercado Pago.
- O painel de administração ainda não permite decidir/encerrar a solicitação ou disparar reembolso; há fila somente leitura para acompanhamento.
- A adequação integral à LGPD NÃO está concluída: faltam identificação e contato público do controlador, inventário de dados/operadores, base legal por finalidade, política de retenção/exclusão, canal operacional para direitos do titular, prazo de resposta, análise de dados de menores e validação jurídica.
- O consentimento de futuras ferramentas opcionais está registrado localmente, mas nenhuma ferramenta de analytics ou marketing está instalada; antes de adicioná-las, vincular seu carregamento a `hasOptionalCookieConsent(category)`, inclusive ao revogar.
- Consulta administrativa de dados pessoais requer capacitação da equipe e restrição de acesso.
- Revisar termos de venda, políticas legais, atendimento e fluxo real de estorno antes de liberar pagamentos em produção.

## Segurança e implantação
- Sem autoelevação de papéis, sem segredos novos, sem bypass de MFA.
- Requer migração incremental `20261115100000_order_cancellation_requests`; não editar migrações anteriores.
- Somente staging na primeira publicação; preservar backup e rollback.
- Testar requisições de usuários diferentes, CSRF e pedidos já reembolsados antes do lançamento real.
