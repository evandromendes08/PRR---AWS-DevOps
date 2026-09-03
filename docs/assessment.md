# Mapa de atendimento aos critérios

| Critério | Evidência |
|---|---|
| Arquitetura completa | `architecture/architecture.md` + diagrama |
| Código IaC | `terraform/` modularizado |
| CI/CD | `.github/workflows/terraform.yml` e `application.yml` |
| AWS | VPC, ALB, ECS/Fargate, ECR, RDS, Cognito, SQS, EventBridge, Lambda, SES, S3 e CloudFront |
| Deploy | Workflow com OIDC e Terraform Apply |
| Demonstração | Microserviços em `services/` e frontend em `frontend/` |
