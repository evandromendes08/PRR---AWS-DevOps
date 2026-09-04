output "vpc_id" {
  value = module.vpc.vpc_id
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "rds_endpoint" {
  value = module.database.endpoint
}

output "registration_queue_url" {
  value = module.messaging.registration_queue_url
}

output "frontend_distribution_domain" { value = module.frontend.distribution_domain_name }
output "frontend_distribution_id" { value = module.frontend.distribution_id }
output "cloudwatch_dashboard_name" { value = module.observability.dashboard_name }
