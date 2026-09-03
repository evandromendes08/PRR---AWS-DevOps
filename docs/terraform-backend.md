# Terraform Remote Backend

The project uses Amazon S3 for remote state and native S3 state locking with
`use_lockfile = true`. DynamoDB locking is intentionally not used.

Run inside the toolbox:

```bash
export AWS_PROFILE=evandro
bash scripts/bootstrap-terraform-backend.sh
```

Then initialize:

```bash
terraform -chdir=terraform/environments/dev init -reconfigure -backend-config=backend.hcl
terraform -chdir=terraform/environments/prod init -reconfigure -backend-config=backend.hcl
```
