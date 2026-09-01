# Sistema de Gerenciamento de Eventos — AWS DevOps

Projeto acadêmico de arquitetura e implementação de uma plataforma de gerenciamento de eventos utilizando serviços da Amazon Web Services (AWS), infraestrutura como código com Terraform e pipeline CI/CD com GitHub Actions.

## 1. Sobre o projeto

O sistema tem como objetivo demonstrar a construção de uma aplicação distribuída para gerenciamento de eventos, considerando aproximadamente **100.000 chamadas por dia**, com possibilidade de expansão de uma operação inicialmente local para uma arquitetura de abrangência global.

O projeto contempla:

- Arquitetura baseada em microserviços;
- Aplicação web simples;
- Containers;
- Infraestrutura na AWS;
- Infraestrutura como Código (IaC);
- Comunicação síncrona e assíncrona;
- Autenticação e autorização;
- Persistência de dados;
- Processamento de pagamentos;
- Controle de ingressos;
- Notificações;
- CI/CD utilizando GitHub Actions.

## 2. Objetivos

O projeto foi desenvolvido para demonstrar, de forma prática:

1. Planejamento de uma arquitetura cloud;
2. Implementação de uma arquitetura de microserviços;
3. Provisionamento automatizado de infraestrutura;
4. Aplicação de boas práticas de segurança;
5. Implementação de comunicação entre serviços;
6. Utilização de serviços gerenciados da AWS;
7. Automação de testes e validações;
8. Deploy automatizado através do GitHub Actions.

## 3. Arquitetura

A solução utiliza uma arquitetura baseada em serviços gerenciados da AWS e containers executados em Amazon ECS com AWS Fargate.

### Principais componentes

- **Amazon VPC** — isolamento da infraestrutura de rede;
- **Subnets públicas e privadas** — organização e segurança dos recursos;
- **Amazon API Gateway** — entrada das requisições da aplicação;
- **AWS WAF** — camada adicional de proteção;
- **Amazon ECS / AWS Fargate** — execução dos microserviços;
- **Amazon ECR** — armazenamento das imagens Docker;
- **Amazon Aurora PostgreSQL** — persistência dos dados;
- **Amazon Cognito** — autenticação dos usuários;
- **Amazon SQS** — processamento assíncrono;
- **Amazon EventBridge** — distribuição de eventos;
- **AWS Lambda** — processamento serverless de tarefas específicas;
- **Amazon SES** — envio de notificações por e-mail;
- **AWS Secrets Manager** — gerenciamento de credenciais e segredos;
- **Amazon CloudWatch** — logs, métricas e monitoramento;
- **Amazon S3** — hospedagem dos arquivos do frontend;
- **Amazon CloudFront** — distribuição do frontend.

O diagrama detalhado da arquitetura está disponível em:

`architecture/architecture.png`

## 4. Microserviços

A aplicação será dividida nos seguintes serviços:

### Event Service

Responsável pelo gerenciamento dos eventos.

Principais operações:

- Criar evento;
- Atualizar evento;
- Consultar eventos;
- Consultar detalhes de um evento;
- Gerenciar informações do evento.

### Ticket Service

Responsável pelo gerenciamento dos ingressos.

Principais operações:

- Criar lotes;
- Definir quantidade disponível;
- Consultar disponibilidade;
- Reservar ingressos;
- Confirmar utilização do ingresso.

### Registration Service

Responsável pelo processo de inscrição do participante.

Fluxo básico:

```text
Participante
    ↓
Seleção do evento
    ↓
Seleção do ingresso
    ↓
Criação da inscrição
    ↓
Pagamento
    ↓
Confirmação
    ↓
Emissão do ingresso
```

### Payment Service

Serviço responsável por representar o processamento de pagamentos.

Para fins acadêmicos, o processamento será simulado.

Estados possíveis:

```text
PENDING
APPROVED
DECLINED
```

### Notification Service

Responsável pelo envio de notificações relacionadas aos eventos do sistema.

Exemplos:

- Confirmação de inscrição;
- Confirmação de pagamento;
- Emissão do ingresso;
- Cancelamento.

## 5. Comunicação entre serviços

A arquitetura utiliza comunicação híbrida.

### Comunicação síncrona

Utilizada principalmente para operações que necessitam de resposta imediata.

Exemplo:

```text
Frontend
   ↓
API Gateway
   ↓
Event Service
```

### Comunicação assíncrona

Utilizada para operações que podem ser processadas posteriormente.

Exemplo:

```text
Payment Service
      ↓
 EventBridge
      ↓
Notification Service
      ↓
     SQS
      ↓
     SES
```

Essa abordagem permite reduzir o acoplamento entre os serviços e melhorar a capacidade de escala da aplicação.

## 6. Infraestrutura como Código

Toda a infraestrutura será provisionada utilizando **Terraform**.

Estrutura principal:

```text
terraform/
├── environments/
│   ├── dev/
│   └── prod/
│
├── modules/
│   ├── vpc/
│   ├── ecs/
│   ├── api-gateway/
│   ├── aurora/
│   ├── cognito/
│   ├── messaging/
│   ├── frontend/
│   ├── security/
│   └── observability/
│
└── global/
```

O objetivo é manter a infraestrutura modular, reutilizável e organizada por responsabilidade.

## 7. Containers

Os microserviços serão empacotados utilizando Docker.

As imagens serão armazenadas no:

**Amazon Elastic Container Registry (ECR)**

E executadas através de:

**Amazon ECS com AWS Fargate**

Dessa forma, o projeto não depende do gerenciamento manual de servidores.

## 8. CI/CD

O pipeline será implementado utilizando **GitHub Actions**.

Os workflows estarão localizados em:

```text
.github/workflows/
```

O processo de integração e entrega seguirá, inicialmente, o seguinte fluxo:

```text
Pull Request
     ↓
Terraform Format
     ↓
Terraform Validate
     ↓
Terraform Plan
     ↓
Code Review
     ↓
Merge na main
     ↓
Terraform Apply
     ↓
Build das aplicações
     ↓
Build das imagens Docker
     ↓
Push para ECR
     ↓
Deploy no ECS
```

## 9. Autenticação AWS

A autenticação do GitHub Actions com a AWS será realizada preferencialmente utilizando **OIDC (OpenID Connect)**.

Fluxo:

```text
GitHub Actions
      ↓
GitHub OIDC
      ↓
AWS IAM Role
      ↓
Recursos AWS
```

Essa abordagem evita a necessidade de armazenar chaves permanentes da AWS no GitHub.

## 10. Ambientes

O projeto será organizado inicialmente em dois ambientes:

```text
dev
prod
```

O ambiente `dev` será utilizado para desenvolvimento e testes.

O ambiente `prod` representará a infraestrutura final utilizada na demonstração do projeto.

## 11. Segurança

A arquitetura considera os seguintes mecanismos:

- VPC isolada;
- Subnets públicas e privadas;
- Security Groups;
- IAM com princípio do menor privilégio;
- Amazon Cognito;
- AWS WAF;
- Secrets Manager;
- Criptografia dos dados;
- Comunicação segura via HTTPS;
- Controle de acesso aos recursos da AWS.

## 12. Observabilidade

A solução utilizará principalmente o Amazon CloudWatch para:

- Logs das aplicações;
- Logs dos containers;
- Métricas;
- Monitoramento dos serviços;
- Identificação de falhas;
- Acompanhamento básico da infraestrutura.

## 13. Demonstração

A demonstração acadêmica deverá apresentar:

1. Arquitetura da solução;
2. Estrutura do projeto;
3. Código Terraform;
4. Configuração dos microserviços;
5. Containers Docker;
6. Configuração do GitHub Actions;
7. Execução do `terraform plan`;
8. Execução do `terraform apply`;
9. Provisionamento dos recursos na AWS;
10. Build e publicação das imagens no ECR;
11. Deploy dos serviços no ECS;
12. Execução da aplicação;
13. Fluxo de criação de evento;
14. Fluxo de inscrição;
15. Simulação de pagamento;
16. Emissão do ingresso;
17. Envio de notificação.

## 14. Estrutura do repositório

```text
PRR---AWS-DevOps/
│
├── .github/
│   └── workflows/
│       ├── terraform.yml
│       ├── application.yml
│       └── destroy.yml
│
├── architecture/
│   ├── architecture.png
│   ├── architecture.svg
│   └── architecture.md
│
├── terraform/
│   ├── environments/
│   │   ├── dev/
│   │   └── prod/
│   │
│   ├── modules/
│   │   ├── vpc/
│   │   ├── ecs/
│   │   ├── api-gateway/
│   │   ├── aurora/
│   │   ├── cognito/
│   │   ├── messaging/
│   │   ├── frontend/
│   │   ├── security/
│   │   └── observability/
│   │
│   └── global/
│
├── services/
│   ├── event-service/
│   ├── ticket-service/
│   ├── registration-service/
│   ├── payment-service/
│   └── notification-service/
│
├── frontend/
│
├── docker/
│
└── README.md
```

## 15. Tecnologias

| Tecnologia | Utilização |
|---|---|
| AWS | Cloud Provider |
| Terraform | Infraestrutura como Código |
| Docker | Containerização |
| ECS Fargate | Execução dos microserviços |
| API Gateway | API de entrada |
| Aurora PostgreSQL | Banco de dados |
| Cognito | Autenticação |
| SQS | Filas |
| EventBridge | Eventos |
| Lambda | Processamento serverless |
| ECR | Registro de imagens |
| S3 | Hospedagem do frontend |
| CloudFront | CDN |
| CloudWatch | Observabilidade |
| Secrets Manager | Gerenciamento de segredos |
| GitHub | Versionamento |
| GitHub Actions | CI/CD |

## 16. Status do projeto

Em desenvolvimento.

### Próximas etapas

- [ ] Criar arquitetura detalhada;
- [ ] Criar diagrama técnico;
- [ ] Criar estrutura Terraform;
- [ ] Criar VPC;
- [ ] Criar IAM/OIDC;
- [ ] Criar ECR;
- [ ] Criar ECS/Fargate;
- [ ] Criar banco de dados;
- [ ] Criar Cognito;
- [ ] Criar SQS/EventBridge;
- [ ] Criar API Gateway;
- [ ] Criar microserviços;
- [ ] Criar frontend;
- [ ] Criar workflows do GitHub Actions;
- [ ] Executar deploy na AWS;
- [ ] Validar aplicação;
- [ ] Gravar demonstração.

---

**Projeto acadêmico — AWS DevOps / Microservices / Terraform / GitHub Actions**