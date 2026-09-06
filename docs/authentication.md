# Autenticação com Amazon Cognito

O frontend cadastra e autentica usuários diretamente no app client público do Cognito. O cadastro confirma o endereço por código enviado pelo Cognito, e o login usa o fluxo `USER_PASSWORD_AUTH`. A senha é enviada somente ao endpoint regional do Cognito e não passa pelo ALB nem pelos microserviços.

O painel **Confirmar uma conta** permanece disponível após recarregar a página e permite solicitar `ResendConfirmationCode` informando o nome de usuário. Isso atende atrasos de entrega ou perda do primeiro código sem intervenção administrativa.

Após o login, o access token permanece em `sessionStorage` e é enviado às APIs no cabeçalho `Authorization: Bearer <token>`. Os cinco microserviços validam localmente assinatura, expiração, `token_use=access`, user pool e app client por meio de `aws-jwt-verify`.

O painel autenticado permite criar ou selecionar um evento, consultar e reservar ingressos, registrar o participante, aprovar o pagamento e acompanhar a atualização assíncrona da inscrição e da notificação. A interface consulta inscrições e notificações após o pagamento até apresentar `PAID` e `SENT`, sem expor o access token na tela.

O **Motor da jornada** registra no próprio frontend os marcos confirmados pelas respostas da aplicação, incluindo rota, microsserviço, horário e duração. Após o pagamento, ele diferencia o caminho síncrono CloudFront → ALB → ECS → RDS do caminho assíncrono EventBridge → SQS → consumidores → SES. O console não inventa telemetria interna: as conclusões assíncronas aparecem somente quando `eventPublished`, `PAID` e `SENT` são observados.

## Rotas

- `/health` e requisições `OPTIONS` permanecem públicas para os health checks e CORS.
- Todas as rotas de negócio exigem um access token quando `AUTH_ENABLED=true`.
- O modo local continua disponível com `AUTH_ENABLED=false`, valor padrão usado pelo Docker Compose.

## Variáveis dos containers

| Variável | Descrição |
|---|---|
| `AUTH_ENABLED` | Ativa a validação Cognito quando definida como `true` |
| `COGNITO_USER_POOL_ID` | Identificador do user pool aceito |
| `COGNITO_CLIENT_ID` | Identificador do app client aceito |

Os identificadores do user pool e do app client não são segredos. Nenhuma credencial de usuário deve ser versionada.

## Validação em DEV

Em 4 de setembro de 2026, o fluxo foi validado com um usuário temporário: autenticação no app client, rejeição sem token, aceitação do access token e chamadas às rotas dos cinco microserviços. O usuário temporário foi removido ao final do teste.

## Usuário de demonstração

O user pool DEV permite auto cadastro pelo frontend e verifica o e-mail por código. Não armazene credenciais no repositório, em arquivos `.env` versionados ou nos workflows.
