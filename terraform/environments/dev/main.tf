module "vpc" {
  source = "../../modules/vpc"

  name = "${var.project_name}-${var.environment}"
}

module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  services     = local.services
}

module "cognito" {
  source = "../../modules/cognito"

  project_name = var.project_name
}

module "messaging" {
  source = "../../modules/messaging"

  project_name = var.project_name
}

module "database" {
  source = "../../modules/rds"

  project_name      = var.project_name
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.vpc.database_security_group_id
}

module "alb" {
  source = "../../modules/alb"

  project_name           = var.project_name
  vpc_id                 = module.vpc.vpc_id
  public_subnet_ids      = module.vpc.public_subnet_ids
  alb_security_group_id  = module.vpc.alb_security_group_id
  services               = local.services
}

module "ecs" {
  source = "../../modules/ecs"

  project_name      = var.project_name
  subnet_ids        = module.vpc.public_subnet_ids
  security_group_id = module.vpc.ecs_security_group_id
  service_repos     = module.ecr.repository_urls
  services          = local.services
  target_group_arns  = module.alb.target_group_arns
}

module "iam" {
  source = "../../modules/iam"

  project_name     = var.project_name
  github_repository = "evandromendes08/PRR---AWS-DevOps"
}

module "frontend" {
  source = "../../modules/frontend"

  project_name = var.project_name
  alb_dns_name = module.alb.dns_name
}

output "alb_dns_name" {
  value = module.alb.dns_name
}

output "github_actions_role_arn" {
  value = module.iam.github_actions_role_arn
}

output "frontend_bucket" {
  value = module.frontend.bucket_name
}
