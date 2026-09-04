# Mapa de atendimento aos critérios

| Critério | Evidência |
|---|---|
| Arquitetura completa | `architecture/architecture.md` + diagrama |
| Código IaC | `terraform/` modularizado |
| CI/CD | `.github/workflows/terraform.yml` e `application.yml` |
| AWS provisionada | VPC, ALB, ECS/Fargate, ECR, RDS, Cognito, SQS, EventBridge, Secrets Manager, S3 e CloudFront |
| Fluxo assíncrono | Pagamento → EventBridge → duas filas SQS → serviços de inscrições e notificações |
| AWS planejada | SES para envio real de notificações; Lambda somente se justificado |
| Deploy | Workflows preparados com OIDC, Terraform Apply, ECR/ECS e S3/CloudFront |
| Demonstração | Microserviços em `services/` e frontend em `frontend/` |
