# PRR — AWS DevOps | Sistema de Gerenciamento de Eventos

Projeto acadêmico de arquitetura cloud, microserviços, Infraestrutura como Código e CI/CD na AWS.

## Cenário

- Aproximadamente 100.000 chamadas por dia.
- Personas: organizadores de eventos e participantes.
- Escopo inicial local, preparado para expansão.
- Aplicação demonstrativa com frontend simples.
- Prioridade: arquitetura tecnicamente coerente e baixo custo operacional para o MVP acadêmico.

## Arquitetura

A solução utiliza:

- Amazon VPC em duas Availability Zones;
- Application Load Balancer;
- ECS com AWS Fargate;
- Docker;
- Amazon ECR;
- Amazon RDS PostgreSQL;
- Amazon Cognito;
- Amazon EventBridge;
- Amazon SQS;
- AWS Lambda;
- Amazon SES;
- Amazon S3;
- Amazon CloudFront;
- AWS Secrets Manager;
- Amazon CloudWatch;
- IAM + GitHub OIDC;
- Terraform;
- GitHub Actions.

O CloudFront funciona como ponto único HTTPS. O frontend é servido pelo S3 e as chamadas com `/api/*` são encaminhadas para o ALB.

O diagrama técnico está em [`architecture/architecture.svg`](architecture/architecture.svg) e [`architecture/architecture.png`](architecture/architecture.png).

## Microserviços

```text
services/
├── event-service/
├── ticket-service/
├── registration-service/
├── payment-service/
└── notification-service/
```

Cada serviço possui um servidor HTTP mínimo, endpoint `/health` e endpoints demonstrativos do domínio.

## Fluxo demonstrativo

```text
Criar evento
    ↓
Criar/consultar ingressos
    ↓
Registrar participante
    ↓
Simular pagamento
    ↓
Publicar evento de pagamento
    ↓
EventBridge → SQS
    ↓
Lambda de notificação
    ↓
SES
```

O `ticket-service` também demonstra controle básico de disponibilidade para evitar reserva acima do estoque disponível.

## Infraestrutura como Código

```text
terraform/
├── environments/
│   ├── dev/
│   └── prod/
└── modules/
    ├── alb/
    ├── cognito/
    ├── ecr/
    ├── ecs/
    ├── frontend/
    ├── iam/
    ├── messaging/
    ├── observability/
    ├── rds/
    └── vpc/
```

A infraestrutura é modularizada por responsabilidade.

## CI/CD

Os workflows estão em `.github/workflows/`.

### Terraform

- `terraform fmt -check`
- `terraform init`
- `terraform validate`
- `terraform plan`
- `terraform apply` na branch `main`

### Aplicação

- Build das imagens Docker;
- Push para ECR;
- Registro de novas task definitions;
- Atualização dos serviços ECS;
- Publicação do frontend no S3.

A autenticação GitHub → AWS utiliza OIDC, evitando chaves AWS de longa duração. O GitHub recomenda restringir a trust policy pela claim `sub` para limitar quais repositórios/branches podem assumir a role. citeturn410081search0turn410081search5

## Backend do Terraform

O estado deve ficar em S3. A configuração inicial está documentada em [`docs/bootstrap.md`](docs/bootstrap.md).

## Execução local dos microserviços

Requisitos:

- Docker
- Docker Compose

Executar:

```bash
docker compose up --build
```

Serviços locais:

- Event: `http://localhost:3001`
- Ticket: `http://localhost:3002`
- Registration: `http://localhost:3003`
- Payment: `http://localhost:3004`
- Notification: `http://localhost:3005`

Exemplo:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/events
```

## Estrutura do repositório

```text
.github/workflows/       # CI/CD
architecture/            # diagramas e especificação
terraform/               # IaC
services/                # microserviços demonstrativos
frontend/                # frontend estático
docs/                    # documentação operacional
README.md
```

## Operação inicial

A primeira execução exige o bootstrap do bucket de state e da role OIDC descrito em [`docs/bootstrap.md`](docs/bootstrap.md).

## Status

- [x] Estrutura inicial do repositório
- [x] Especificação inicial da arquitetura
- [x] Diagrama técnico
- [x] Módulos Terraform iniciais
- [x] Microserviços demonstrativos
- [x] Dockerfiles
- [x] Docker Compose
- [x] Workflows GitHub Actions
- [ ] Validar Terraform em AWS
- [ ] Criar backend remoto definitivo
- [ ] Executar primeiro deploy
- [ ] Validar fluxo completo
- [ ] Refinar observabilidade e segurança
- [ ] Gravar vídeo final
