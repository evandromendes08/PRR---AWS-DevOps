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

resource "aws_iam_role_policy" "database_secret" {
  name = "database-secret-read"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = var.database_secret_arn
    }]
  })
}

locals {
  messaging_services = toset(["payment", "registration", "notification"])
}

resource "aws_iam_role" "task" {
  for_each = local.messaging_services

  name = "${var.project_name}-${each.key}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "payment_events" {
  name = "eventbridge-publish"
  role = aws_iam_role.task["payment"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "events:PutEvents"
      Resource = var.event_bus_arn
    }]
  })
}

resource "aws_iam_role_policy" "queue_consumer" {
  for_each = var.consumer_queues

  name = "sqs-consume"
  role = aws_iam_role.task[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:ChangeMessageVisibility",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ReceiveMessage"
      ]
      Resource = each.value.arn
    }]
  })
}

resource "aws_ecs_task_definition" "service" {
  for_each = var.services

  family                   = "${var.project_name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = try(aws_iam_role.task[each.key].arn, null)

  container_definitions = jsonencode([{
    name      = each.key
    image     = "${var.service_repos[each.key]}:${var.image_tag}"
    essential = true
    portMappings = [{
      containerPort = each.value.port
      protocol      = "tcp"
    }]
    environment = concat([
      { name = "DB_ENABLED", value = "true" },
      { name = "DB_HOST", value = var.database_host },
      { name = "DB_PORT", value = "5432" },
      { name = "DB_NAME", value = var.database_name },
      { name = "DB_SSL", value = "true" },
      { name = "AUTH_ENABLED", value = "true" },
      { name = "COGNITO_USER_POOL_ID", value = var.cognito_user_pool_id },
      { name = "COGNITO_CLIENT_ID", value = var.cognito_client_id }
      ], each.key == "payment" ? [
      { name = "MESSAGING_ENABLED", value = "true" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "EVENT_BUS_NAME", value = var.event_bus_name }
      ] : contains(["registration", "notification"], each.key) ? [
      { name = "MESSAGING_ENABLED", value = "true" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "SQS_QUEUE_URL", value = var.consumer_queues[each.key].url }
    ] : [])
    secrets = [
      { name = "DB_USER", valueFrom = "${var.database_secret_arn}:username::" },
      { name = "DB_PASSWORD", valueFrom = "${var.database_secret_arn}:password::" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
        awslogs-region        = var.aws_region
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
  desired_count   = var.desired_count
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
}
