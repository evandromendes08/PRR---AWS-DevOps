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

  project_name         = local.resource_prefix
  subnet_ids           = module.vpc.public_subnet_ids
  security_group_id    = module.vpc.ecs_security_group_id
  service_repos        = module.ecr.repository_urls
  services             = local.services
  target_group_arns    = module.alb.target_group_arns
  desired_count        = var.ecs_desired_count
  image_tag            = var.ecs_image_tag
  aws_region           = var.aws_region
  database_host        = module.database.endpoint
  database_name        = "events"
  database_secret_arn  = module.database.secret_arn
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
  event_bus_name       = module.messaging.event_bus_name
  event_bus_arn        = module.messaging.event_bus_arn
  consumer_queues = {
    registration = {
      arn = module.messaging.registration_queue_arn
      url = module.messaging.registration_queue_url
    }
    notification = {
      arn = module.messaging.notification_queue_arn
      url = module.messaging.notification_queue_url
    }
  }
}

# The GitHub OIDC provider/role is shared and managed by the dev environment.
module "frontend" {
  source = "../../modules/frontend"

  project_name = local.resource_prefix
  alb_dns_name = module.alb.dns_name
}

module "observability" {
  source = "../../modules/observability"

  project_name             = local.resource_prefix
  services                 = toset(keys(local.services))
  load_balancer_arn_suffix = module.alb.arn_suffix
}

output "alb_dns_name" {
  value = module.alb.dns_name
}

output "frontend_bucket" {
  value = module.frontend.bucket_name
}
