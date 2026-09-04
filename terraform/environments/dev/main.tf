locals {
  resource_prefix = "${var.project_name}-${var.environment}"
}

module "vpc" {
  source = "../../modules/vpc"
  name   = local.resource_prefix
}

module "ecr" {
  source       = "../../modules/ecr"
  project_name = local.resource_prefix
  services     = local.services
}

module "cognito" {
  source       = "../../modules/cognito"
  project_name = local.resource_prefix
}

module "messaging" {
  source       = "../../modules/messaging"
  project_name = local.resource_prefix
}

module "database" {
  source = "../../modules/rds"

  project_name      = local.resource_prefix
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.vpc.database_security_group_id
}

module "alb" {
  source = "../../modules/alb"

  project_name          = local.resource_prefix
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = module.vpc.alb_security_group_id
  services              = local.services
}

module "ecs" {
  source = "../../modules/ecs"

  project_name      = local.resource_prefix
  subnet_ids        = module.vpc.public_subnet_ids
  security_group_id = module.vpc.ecs_security_group_id
  service_repos     = module.ecr.repository_urls
  services          = local.services
  target_group_arns = module.alb.target_group_arns
  desired_count     = var.ecs_desired_count
  image_tag         = var.ecs_image_tag
}

# GitHub OIDC is account-wide and is managed once from the dev environment.
module "iam" {
  source = "../../modules/iam"

  project_name                   = var.project_name
  github_oidc_subject_repository = "evandromendes08@163218496/PRR---AWS-DevOps@1353832769"
}

module "frontend" {
  source = "../../modules/frontend"

  project_name = local.resource_prefix
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
