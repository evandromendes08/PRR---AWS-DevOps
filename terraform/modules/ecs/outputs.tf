output "cluster_name" { value = aws_ecs_cluster.this.name }
output "execution_role_arn" { value = aws_iam_role.execution.arn }
output "service_names" { value = { for k, v in aws_ecs_service.service : k => v.name } }
