# SwiftMC — Performance, SEO e lançamento seguro

Este documento descreve o que o código oferece e o que ainda depende de ações na Cloudflare/Google. **Uma build verde não é uma medição de desempenho real.**

## 1. Implementado no site

- `/robots.txt`, `/sitemap.xml`, metadata/canonical, Open Graph/Twitter e manifesto web já existem.
- JSON-LD gerado com escape anti-HTML: `WebSite` (site inteiro), `Article` (notícias publicadas) e `BreadcrumbList` (páginas VIP). Não anuncia produtos, eventos ou avaliações inexistentes.
- 404 em português com links úteis.
- Skeletons acessíveis para home, loja, ranks, status, jogadores, notícias/artigos, wiki/artigos, eventos, conta/pedidos e painel. Skeleton melhora a **percepção** de carregamento; não substitui otimização de TTFB ou JS.
- Imagens oficiais WebP via `next/image`, dimensões responsivas e lazy loading para imagem decorativa da loja; LCP da home usa `priority`.
- Busca global importada dinamicamente apenas quando aberta. Polling Minecraft pausa quando a aba está oculta ou o navegador está offline.
- Cache para arquivos `/brand` de 1 dia com revalidação de até 7 dias; imagens rank `-v2.webp` são imutáveis por 1 ano. **Nunca substituir o arquivo mantendo seu nome versionado**; publicar `-v3.webp` quando mudar a imagem e atualizar os caminhos.
- Conteúdo de sessão, admin, checkout e endpoints privados recebem `Cache-Control: private, no-store`. O backend também possui cache curto em memória para status e jogadores, que NÃO é Redis nem cache distribuído.

## 2. Cloudflare — manter o conteúdo privado fora de cache

Em **Caching → Cache Rules**, cachear somente recursos públicos e invariáveis, por exemplo:

- `/_next/static/*`: usar cache padrão do Next (arquivos com hash). Não remover `immutable`.
- `/brand/ranks/*-v2.webp`: preferir respeitar cabeçalho `public, max-age=31536000, immutable`. Versionar arquivo ao trocar imagens.
- `/brand/*`: preferir respeitar cabeçalho padrão `public, max-age=86400, stale-while-revalidate=604800`.

**Não criar regra `Cache Everything` para todo `swiftmc.com.br`.** O HTML do site usa componentes que verificam sessão. Não cachear HTML que possa incluir identificação de usuário, nem rotas `/admin*`, `/account*`, `/checkout*`, `/login*`, `/register*`, `/api/admin*`, `/api/user*`, `/api/checkout*`, pagamentos/webhooks ou respostas com `Set-Cookie`. A autenticação Cloudflare Access não torna cache desses dados seguro.

A API pública `/api/server-status` retorna `s-maxage=15` e pode ser cacheada com muito cuidado por até 15 s, apenas após verificar que a resposta não tem dados personalizados. `/api/players/online` responde `no-store`; preserve isso nesta fase.

Para verificar a origem real dos cabeçalhos: `curl -I https://staging.swiftmc.com.br/brand/ranks/swift-v2.webp` e `curl -I https://staging.swiftmc.com.br/account` (sem sessão, a Cloudflare pode responder antes do Next). Examine `Cache-Control`, `CF-Cache-Status`, `Age` e `Set-Cookie`, sem confundir `DYNAMIC` com um erro.

## 3. HTTPS e segurança

Em **SSL/TLS**, usar `Full (strict)` com certificado da origem válido. Habilitar **Always Use HTTPS** depois de confirmar HTTPS nas rotas principais e integrações. Não habilitar HSTS com `includeSubDomains`/preload automaticamente: isso afetaria também outros subdomínios do projeto. Caso vá habilitar HSTS, testar HTTPS de todos os domínios primeiro e começar com uma política curta.

Headers de aplicação existentes: CSP de base (usa `unsafe-inline` por exigência atual do Next/RSC), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy`. **Não apresentar essa CSP como proteção completa contra XSS**; a redução de scripts inline exige avaliação separada.

A aplicação privada `/admin` no Cloudflare Access deve continuar com login/role/MFA do próprio site. Não desabilitar a verificação no backend.

## 4. Google Search Console — configuração do responsável

1. Acessar https://search.google.com/search-console.
2. Adicionar a propriedade de **Domínio** `swiftmc.com.br` e confirmar a posse pelo registro TXT no DNS da Cloudflare (recomendado). Isso independe de token no HTML.
3. Enviar o sitemap `https://swiftmc.com.br/sitemap.xml`; verificar `https://swiftmc.com.br/robots.txt`.
4. Não submeter `staging.swiftmc.com.br` como propriedade indexável. Staging recebe `noindex`.
5. Opcional: também é possível adicionar ao GitHub Actions variável pública `SWIFTMC_GOOGLE_SITE_VERIFICATION` com token válido; o Docker build gera a meta tag `google-site-verification`. Isso requer nova imagem, não uma alteração apenas no `staging.env`.

Sitemap/robots não garantem indexação. Testar URL Inspection no Search Console.

## 5. GA4 e eventos — desativados por padrão

Há integração preparada, **mas não é ativada sem o identificador** e consentimento explícito de estatísticas. Antes de conectar a coleta real, revisar a Política de Privacidade, responsáveis, retenção, atendimento LGPD e consentimento.

1. Criar uma propriedade Google Analytics 4, coletar o ID de medição `G-...`.
2. Criar no GitHub do projeto a variável de repositório **não secreta** `SWIFTMC_GA4_MEASUREMENT_ID`. O workflow injeta o valor no argumento de build `NEXT_PUBLIC_GA4_MEASUREMENT_ID`.
3. Publicar nova imagem após configurar a variável. O valor **não será incorporado retroativamente** em imagens já publicadas.
4. O script GA4 somente é carregado em páginas públicas depois de `Estatísticas` ser aceito no botão Cookies. Rotas de login, conta, admin, pagamento e checkout não são rastreadas. Ao revogar, o site bloqueia a coleta, tenta limpar cookies GA acessíveis e reinicia a página para liberar o SDK da memória.
5. Eventos preparados: `page_view` em navegação pública; `select_item` e `begin_checkout` em cliques de catálogo. Nenhum e-mail, username Minecraft, token, dado de cartão ou ID de sessão é enviado por esses eventos.

Mesmo configurado, validar a implementação com Google Tag Assistant e a política LGPD antes de habilitar GA4 em produção. Futuros scripts de publicidade têm categoria separada e não são ativados por este pacote.

## 6. Medir velocidade antes de afirmar resultados

Rodar no GitHub **Actions → web-performance-audit → Run workflow**, escolhendo `staging` ou `production`. O workflow é manual, roda o Lighthouse 13.6.0 (mobile home/loja, desktop home) e uma checagem de TTFB de cabeçalhos/cache de nove URLs públicas. Relatórios HTML/JSON ficam nos artefatos do workflow por 14 dias.

Também pode executar no computador:
```bash
node scripts/audit-public-web.mjs https://staging.swiftmc.com.br
```

Metas de campo para o percentil 75: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Não há pontuação/medição comprovada nesta entrega; medir em dispositivos reais e conexão móvel. Lighthouse é sintético e pode variar. Se Cloudflare desafiar automações ou houver proteção de bots, a execução remota pode falhar mesmo com o site saudável.

## 7. Deploy e QA

- Staging primeiro: usar tag imutável com `scripts/deploy-staging.sh`; validar `/api/health/ready`, navegação, mobile, skeletons, busca, login, MFA e regras do Cloudflare Access.
- Não mudar rotas de pagamentos ou estado de pedidos para melhorar cache.
- Validar em **janela anônima**, **usuário logado** e **admin**: a área de conta não pode ser mostrada a terceiros nem reaparecer via Back/Cache após logout.
- Conferir fonte/carregamento e layout no modo `prefers-reduced-motion`.
- Rollback: tag anterior imutável. Este pacote não inclui migrações de banco.
