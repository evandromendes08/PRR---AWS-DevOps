# Observabilidade e segurança

Esta etapa mantém a arquitetura e o perfil de baixo custo do projeto. Ela não adiciona NAT Gateway, WAF, serviços premium nem recursos fora do ambiente gerenciado pelo Terraform.

## Controles preparados

- dashboard `event-management-<ambiente>-operations` com CPU e memória do ECS, requisições/latência/5xx do ALB, CPU/conexões/espaço do RDS e profundidade/idade das filas SQS;
- dez alarmes padrão: CPU dos cinco serviços, 5xx dos targets do ALB, CPU e espaço livre do RDS e uma DLQ não vazia por consumidor;
- duas DLQs com criptografia SQS gerenciada, retenção de 14 dias, redrive após cinco recebimentos e permissão restrita à fila correspondente;
- circuit breaker e rollback automático nos cinco serviços ECS, com 30 segundos de tolerância inicial ao healthcheck;
- entrada HTTP do Security Group do ALB limitada à prefix list AWS `com.amazonaws.global.cloudfront.origin-facing`;
- política CloudFront com HSTS, bloqueio de frames, prevenção de MIME sniffing, Referrer Policy e XSS Protection;
- imagens `linux/amd64` executadas como usuário `node`, com OpenSSL atualizado e npm/npx removidos do runtime.

Os alarmes não têm ações SNS nesta fase, evitando criar um tópico sem destinatário definido. O dashboard e os dez alarmes foram dimensionados para a faixa gratuita padrão do CloudWatch, mas a franquia é compartilhada pela conta e deve ser conferida antes de replicar o ambiente.

A role OIDC do GitHub Actions possui apenas as ações CloudWatch necessárias para consultar e gerenciar dashboards, alarmes e suas tags. Não foi concedido `cloudwatch:*` nem `AdministratorAccess`, e a trust policy do repositório permaneceu inalterada.

## Banco de dados

O módulo RDS habilita criptografia por padrão para novas instâncias, incluindo PROD. O RDS DEV existente não é criptografado e permanece explicitamente com `storage_encrypted = false`, pois habilitar criptografia nele exigiria substituição e migração dos dados. O plano DEV foi verificado para não substituir nem destruir o banco. Tags passam a ser copiadas para snapshots.

## Evidências locais

Em 4 de setembro de 2026:

- a suíte integrada passou com os cinco healthchecks, autenticação, validações, persistência PostgreSQL e teste concorrente de reservas;
- as cinco imagens foram construídas para `linux/amd64` e publicadas nos ECRs DEV existentes;
- o Docker Scout reportou `0 critical`, `0 high`, `0 medium` e `0 low` nas cinco imagens;
- os scans automáticos dos cinco repositórios ECR terminaram como `COMPLETE`, sem achados em qualquer severidade;
- `terraform validate` passou em DEV e PROD;
- o plano DEV resultou em `16 to add, 10 to change, 0 to destroy`.

## Validação em DEV

Em 5 de setembro de 2026, o apply autorizado terminou com `16 added, 10 changed, 0 destroyed`. A verificação posterior confirmou:

- frontend e `/api/health` com HTTP 200 via CloudFront e todos os headers configurados;
- acesso HTTP direto ao ALB bloqueado por timeout;
- cinco serviços ECS com `desired=1`, `running=1`, rollout concluído e circuit breaker ativo;
- cinco target groups saudáveis;
- dashboard disponível e dez alarmes em estado `OK`;
- filas principais e DLQs criptografadas, vazias e com redrive configurado;
- RDS disponível, privado e sem substituição;
- plano Terraform final sem mudanças.

## Referências AWS

- [CloudFront managed prefix list](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/LocationsOfEdgeServers.html)
- [AWS managed prefix lists](https://docs.aws.amazon.com/vpc/latest/userguide/working-with-aws-managed-prefix-lists.html)
- [SQS dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)
- [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)
