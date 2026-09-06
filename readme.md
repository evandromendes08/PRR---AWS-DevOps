# PRR — AWS DevOps | Sistema de Gerenciamento de Eventos

Projeto acadêmico de arquitetura cloud, microserviços, Infraestrutura como Código e CI/CD na AWS.

## Cenário

- Aproximadamente 100.000 chamadas por dia.
- Personas: organizadores de eventos e participantes.
- Escopo inicial local, preparado para expansão.
- Aplicação demonstrativa com interface guiada para o fluxo completo de negócio.
- Prioridade: arquitetura tecnicamente coerente e baixo custo operacional para o MVP acadêmico.

## Arquitetura

A arquitetura alvo utiliza:

- Amazon VPC em duas Availability Zones;
- Application Load Balancer;
- ECS com AWS Fargate;
- Docker;
- Amazon ECR;
- Amazon RDS PostgreSQL;
- Amazon Cognito;
- Amazon EventBridge;
- Amazon SQS;
- Amazon SES para envio real de e-mail; Lambda somente como evolução se houver justificativa;
- Amazon S3;
- Amazon CloudFront;
- AWS Secrets Manager;
- Amazon CloudWatch;
- IAM + GitHub OIDC;
- Terraform;
- GitHub Actions.

O CloudFront funciona como ponto único HTTPS. O frontend é servido pelo S3 e as chamadas com `/api/*` são encaminhadas para o ALB.

O Terraform também prepara cabeçalhos HTTP de segurança, restringe a entrada do ALB à lista gerenciada de servidores de origem do CloudFront, ativa rollback automático dos deployments ECS, adiciona DLQs às filas e centraliza métricas operacionais em um dashboard CloudWatch.

O diagrama técnico está em [`architecture/architecture.svg`](architecture/architecture.svg) e [`architecture/architecture.png`](architecture/architecture.png).

O roteiro reproduzível para a apresentação está em [`docs/demo-video.md`](docs/demo-video.md), acompanhado pelo coletor somente leitura [`scripts/collect-demo-evidence.sh`](scripts/collect-demo-evidence.sh).

## Microserviços

```text
services/
├── event-service/
├── ticket-service/
├── registration-service/
├── payment-service/
└── notification-service/
```

Cada serviço possui endpoint `/health`, rotas demonstrativas do domínio e suporte a PostgreSQL.

Com `DB_ENABLED=true`, os dados são persistidos no PostgreSQL; sem essa variável, os serviços utilizam memória para testes rápidos. Cognito protege as rotas de negócio. O pagamento aprovado é publicado no EventBridge e distribuído para duas filas SQS consumidas pelos serviços de inscrições e notificações. Em DEV, o `notification-service` envia a confirmação real pelo SES para a identidade verificada do ambiente.

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
EventBridge
    ↓
SQS de inscrições ─→ Atualizar inscrição para PAID
    +
SQS de notificações ─→ Enviar e-mail pelo SES e persistir notificação SENT
```

O `ticket-service` também demonstra controle básico de disponibilidade para evitar reserva acima do estoque disponível.

O frontend conduz esse fluxo em cinco etapas, identifica o microsserviço responsável por cada operação, acompanha automaticamente o processamento assíncrono e exibe os estados `PAID` e `SENT` quando a jornada é concluída.

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
    ├── ses/
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

- Teste integrado dos cinco serviços com PostgreSQL;
- Build das imagens Docker;
- Validação das imagens em `linux/amd64`;
- Push para ECR;
- Novo deployment dos serviços ECS;
- Publicação do frontend no S3.

A autenticação GitHub → AWS utiliza OIDC, evitando chaves AWS de longa duração. A trust policy restringe a claim `sub` à branch `main` e aos pull requests deste repositório.

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

O Compose habilita PostgreSQL para os cinco serviços. Para executar o cenário automatizado de persistência e concorrência:

```bash
bash scripts/test-services.sh
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

## Pausar e retomar DEV

O ambiente DEV mantém por padrão `ecs_desired_count = 1` para permanecer acessível durante a demonstração. Para reduzir custos, aplique temporariamente `-var='ecs_desired_count=0'`. O RDS também pode ser interrompido, mas a AWS o reinicia automaticamente após no máximo sete dias. ALB, CloudFront, S3, ECR e o armazenamento do RDS permanecem provisionados e continuam gerando custo residual.

Antes de uma demonstração, inicie o RDS, aguarde o status `available` e aplique o Terraform com o valor `1`. Ao terminar, reaplique com o valor `0` e interrompa novamente o RDS. Nunca execute `terraform destroy` como parte desse procedimento operacional.

## Status

- [x] Estrutura inicial do repositório
- [x] Especificação inicial da arquitetura
- [x] Diagrama técnico
- [x] Módulos Terraform iniciais
- [x] Microserviços demonstrativos
- [x] Dockerfiles
- [x] Docker Compose
- [x] Workflows GitHub Actions
- [x] Validar Terraform em AWS
- [x] Criar backend remoto definitivo
- [x] Executar primeiro deploy DEV
- [x] Publicar as cinco imagens no ECR
- [x] Executar e validar cinco serviços no ECS
- [x] Publicar frontend no S3/CloudFront
- [x] Validar fluxo HTTP frontend → CloudFront → ALB → ECS
- [x] Preparar workflows GitHub Actions
- [x] Validar os workflows no GitHub após o push
- [x] Implementar e testar persistência PostgreSQL local
- [x] Ativar e validar a integração RDS/Secrets Manager nas task definitions DEV
- [x] Preparar autenticação Cognito e validar bloqueio local das APIs
- [x] Ativar e validar Cognito em DEV
- [x] Implementar e testar localmente a integração EventBridge/SQS
- [x] Ativar e validar EventBridge/SQS em DEV
- [x] Endurecer e validar as cinco imagens Docker sem vulnerabilidades detectadas
- [x] Preparar observabilidade, DLQs e controles de segurança no Terraform
- [x] Aplicar e validar observabilidade e segurança em DEV
- [x] Integrar e validar o envio real de e-mail com SES
- [ ] Gravar vídeo final
