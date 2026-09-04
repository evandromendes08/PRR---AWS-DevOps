# Arquitetura — Sistema de Gerenciamento de Eventos

## Premissas

- Aproximadamente 100.000 chamadas/dia.
- Operação inicial local com arquitetura preparada para expansão.
- Projeto acadêmico, priorizando simplicidade operacional e baixo custo.
- AWS como provedor de nuvem.
- Terraform para IaC.
- GitHub Actions + OIDC para CI/CD.

## Decisões

| Camada | Tecnologia |
|---|---|
| Frontend | HTML/CSS/JavaScript estático + S3 + CloudFront |
| Entrada HTTPS | Amazon CloudFront |
| Entrada API | Application Load Balancer |
| Compute | Amazon ECS / AWS Fargate |
| Containers | Docker |
| Dados | Amazon RDS PostgreSQL |
| Auth | Amazon Cognito |
| Assíncrono | Amazon EventBridge + Amazon SQS |
| Notificações | notification-service consumindo SQS; Amazon SES como evolução |
| Secrets | AWS Secrets Manager |
| Logs | Amazon CloudWatch |
| Registro de imagens | Amazon ECR |
| IaC | Terraform |
| CI/CD | GitHub Actions + OIDC |

## Fluxo principal

```text
Usuário
   |
 HTTPS
   v
CloudFront
   |-----------------------------> S3
   |
   +---- /api/* ----------------> ALB
                                      |
                   +------------------+------------------+
                   |        |          |        |        |
                   v        v          v        v        v
                 Event    Ticket   Registration Payment Notification
                 Service  Service    Service    Service   Service
                   |        |          |        |        |
                   +--------+----------+--------+--------+
                                      |
                                      v
                                RDS PostgreSQL

Payment Service
      |
      v
EventBridge
      |---------------------------|
      v                           v
SQS Registration Queue     SQS Notification Queue
      |                           |
      v                           v
Registration Service       Notification Service
(status PAID)              (registro QUEUED)
```

## Rede

- VPC `10.20.0.0/16`.
- Duas Availability Zones.
- Duas subnets de aplicação com saída pública simplificada para o MVP, mas sem exposição direta dos containers: a entrada na porta 3000 é permitida somente pelo Security Group do ALB.
- Duas subnets privadas para o RDS.
- Internet Gateway para os recursos de borda/aplicação.
- Security Groups separados para ALB, ECS e banco.

A escolha de não utilizar NAT Gateway nesta primeira versão reduz custo recorrente. Em um cenário de produção, os containers seriam preferencialmente movidos para subnets privadas e o acesso de saída seria controlado por NAT Gateway e/ou VPC Endpoints.

## Segurança

- Cognito para autenticação.
- Access tokens Cognito validados diretamente pelos microserviços; `/health` permanece público para o ALB.
- CloudFront como ponto público HTTPS.
- ALB como única entrada de API.
- Containers sem regra de entrada aberta à Internet.
- RDS sem exposição pública.
- Secrets Manager para credenciais do banco.
- IAM com princípio do menor privilégio como objetivo de evolução.
- OIDC para autenticação do GitHub Actions na AWS, evitando chaves AWS de longa duração.

A trust policy do role OIDC restringe a claim `sub` à branch `main` e aos pull requests deste repositório.

## Escalabilidade

- ECS Fargate permite aumentar o número de tasks por serviço.
- ALB distribui requisições entre tasks.
- Mensageria assíncrona desacopla a confirmação da inscrição e a criação da notificação do pagamento.
- RDS mantém o modelo relacional necessário para eventos, ingressos, inscrições e pagamentos.

## Capacidade

100.000 chamadas/dia representam aproximadamente 1,16 requisições/s em média. Portanto, o requisito não justifica Kubernetes, service mesh, Kafka ou arquitetura multi-região na primeira entrega.

## Justificativa do fluxo HTTPS

O CloudFront entrega o frontend e também encaminha `/api/*` para o ALB. Assim, o navegador utiliza uma única origem HTTPS e evitamos que o frontend servido por HTTPS tente chamar diretamente uma API HTTP, além de simplificar CORS.

## Evolução futura

- Integrar Amazon SES ao `notification-service` para o envio real de e-mail; avaliar Lambda apenas se houver benefício operacional.
- Evoluir as migrações de banco para uma ferramenta versionada antes de uso em produção.
- Adicionar DLQs e alarmes para falhas repetidas nos consumidores SQS.
- API Gateway na frente do ALB caso requisitos de gerenciamento de APIs aumentem.
- WAF associado ao CloudFront.
- Subnets privadas para ECS + NAT/VPC Endpoints.
- Multi-AZ mais rigoroso para dados.
- Cache com ElastiCache/Redis se necessário.
- Multi-região para expansão mundial.
