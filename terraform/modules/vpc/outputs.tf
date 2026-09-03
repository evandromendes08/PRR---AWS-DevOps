output "vpc_id" { value = aws_vpc.this.id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "ecs_security_group_id" { value = aws_security_group.ecs.id }
output "database_security_group_id" { value = aws_security_group.database.id }
output "alb_security_group_id" { value = aws_security_group.alb.id }
