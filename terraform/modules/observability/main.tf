data "aws_region" "current" {}

locals {
  queue_names = toset(["registration", "notification"])

  ecs_metrics = concat([
    for service in sort(tolist(var.services)) : [
      ["AWS/ECS", "CPUUtilization", "ClusterName", "${var.project_name}-cluster", "ServiceName", "${var.project_name}-${service}", { label = "${service} CPU" }],
      ["AWS/ECS", "MemoryUtilization", "ClusterName", "${var.project_name}-cluster", "ServiceName", "${var.project_name}-${service}", { label = "${service} memory" }]
    ]
  ]...)

  queue_metrics = concat([
    for queue in sort(tolist(local.queue_names)) : [
      ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-${queue}", { label = "${queue} visible" }],
      ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", "${var.project_name}-${queue}", { label = "${queue} oldest age" }],
      ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-${queue}-dlq", { label = "${queue} DLQ" }]
    ]
  ]...)
}

resource "aws_cloudwatch_dashboard" "application" {
  dashboard_name = "${var.project_name}-operations"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2
        properties = {
          markdown = "# ${var.project_name}\nECS, ALB, RDS and asynchronous queue health"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 12
        height = 6
        properties = {
          title   = "ECS CPU and memory"
          view    = "timeSeries"
          region  = data.aws_region.current.region
          stat    = "Average"
          period  = 300
          metrics = local.ecs_metrics
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 2
        width  = 12
        height = 6
        properties = {
          title  = "ALB requests, latency and target errors"
          view   = "timeSeries"
          region = data.aws_region.current.region
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.load_balancer_arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.load_balancer_arn_suffix],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.load_balancer_arn_suffix, { stat = "Average" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 8
        width  = 12
        height = 6
        properties = {
          title  = "RDS"
          view   = "timeSeries"
          region = data.aws_region.current.region
          period = 300
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "${var.project_name}-postgres", { stat = "Average" }],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "${var.project_name}-postgres", { stat = "Average" }],
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", "${var.project_name}-postgres", { stat = "Average", yAxis = "right" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 8
        width  = 12
        height = 6
        properties = {
          title   = "SQS and dead-letter queues"
          view    = "timeSeries"
          region  = data.aws_region.current.region
          stat    = "Maximum"
          period  = 60
          metrics = local.queue_metrics
        }
      }
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  for_each = var.services

  alarm_name          = "${var.project_name}-${each.key}-cpu-high"
  alarm_description   = "ECS average CPU is above 80% for ten minutes."
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = "${var.project_name}-cluster"
    ServiceName = "${var.project_name}-${each.key}"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_target_5xx" {
  alarm_name          = "${var.project_name}-alb-target-5xx"
  alarm_description   = "ALB targets returned five or more 5xx responses in five minutes."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.project_name}-rds-cpu-high"
  alarm_description   = "RDS average CPU is above 80% for ten minutes."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = "${var.project_name}-postgres"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "${var.project_name}-rds-storage-low"
  alarm_description   = "RDS free storage is below 2 GiB."
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 2147483648
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = "${var.project_name}-postgres"
  }
}

resource "aws_cloudwatch_metric_alarm" "dead_letter_messages" {
  for_each = local.queue_names

  alarm_name          = "${var.project_name}-${each.key}-dlq-not-empty"
  alarm_description   = "The ${each.key} dead-letter queue contains a message."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = "${var.project_name}-${each.key}-dlq"
  }
}
