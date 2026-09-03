resource "aws_cloudwatch_log_group" "service" {
  for_each = var.services

  name              = "/ecs/${var.project_name}/${each.key}"
  retention_in_days = 7
}

resource "aws_ecs_cluster" "this" {
  name = "${var.project_name}-cluster"
}

resource "aws_iam_role" "execution" {
  name = "${var.project_name}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_task_definition" "service" {
  for_each = var.services

  family                   = "${var.project_name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name      = each.key
    image     = "${var.service_repos[each.key]}:placeholder"
    essential = true
    portMappings = [{
      containerPort = each.value.port
      protocol      = "tcp"
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
        awslogs-region        = "us-east-1"
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "service" {
  for_each = var.services

  name            = "${var.project_name}-${each.key}"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.service[each.key].arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = var.target_group_arns[each.key]
    container_name   = each.key
    container_port   = each.value.port
  }

  lifecycle {
    ignore_changes = [task_definition]
  }
}
