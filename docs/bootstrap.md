# Bootstrap da AWS

A primeira execução precisa criar o backend remoto do Terraform e o role usado pelo GitHub Actions. Essa etapa é feita uma única vez com credenciais administrativas locais.

## 1. Criar bucket do estado

```bash
aws s3api create-bucket \
  --bucket SEU_BUCKET_GLOBALMENTE_UNICO \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket SEU_BUCKET_GLOBALMENTE_UNICO \
  --versioning-configuration Status=Enabled

aws s3api put-public-access-block \
  --bucket SEU_BUCKET_GLOBALMENTE_UNICO \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## 2. Configurar o backend

Copie `terraform/environments/dev/backend.hcl.example` para `backend.hcl` e substitua o nome do bucket.

O arquivo `backend.hcl` não deve ser versionado quando contiver dados específicos do ambiente.

## 3. Primeira execução

```bash
cd terraform/environments/dev
terraform init
terraform plan
terraform apply
```

Após a primeira execução, confirme que o output `github_actions_role_arn` corresponde ao valor `AWS_ROLE_ARN` configurado nos workflows.

## 4. Atenção sobre permissões

O role de GitHub Actions da primeira versão usa uma política ampla para simplificar o projeto acadêmico e permitir que o Terraform crie os recursos necessários. Antes de utilizar esta solução em produção, essa política deve ser substituída por permissões específicas por serviço e por ambiente.

## 5. Configuração do GitHub Actions

O ARN da role OIDC e o nome do bucket não são credenciais secretas e ficam configurados como variáveis de ambiente nos workflows:

- `AWS_ROLE_ARN`: ARN do role criado pelo Terraform.
- `TF_STATE_BUCKET`: nome do bucket S3 usado pelo state remoto.

Não configure access key ou secret access key. A autenticação deve continuar usando OIDC.

O workflow de PR executa `plan`; o workflow em `main` executa `apply` e, na sequência, publica imagens no ECR, atualiza o ECS e publica o frontend.
