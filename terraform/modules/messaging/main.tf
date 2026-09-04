resource "aws_sqs_queue" "dead_letter" {
  for_each = toset(["registration", "notification"])

  name                      = "${var.project_name}-${each.key}-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "registration" {
  name                       = "${var.project_name}-registration"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter["registration"].arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue" "notification" {
  name                       = "${var.project_name}-notification"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter["notification"].arn
    maxReceiveCount     = 5
  })
}

locals {
  source_queues = {
    registration = aws_sqs_queue.registration
    notification = aws_sqs_queue.notification
  }
}

resource "aws_sqs_queue_redrive_allow_policy" "dead_letter" {
  for_each = local.source_queues

  queue_url = aws_sqs_queue.dead_letter[each.key].url
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [each.value.arn]
  })
}

resource "aws_cloudwatch_event_bus" "domain" {
  name = "${var.project_name}-domain"
}

resource "aws_cloudwatch_event_rule" "payment_approved" {
  name           = "${var.project_name}-payment-approved"
  event_bus_name = aws_cloudwatch_event_bus.domain.name

  event_pattern = jsonencode({
    source        = ["event-management.payment"]
    "detail-type" = ["PaymentApproved"]
  })
}

locals {
  payment_approved_targets = {
    registration = {
      arn = aws_sqs_queue.registration.arn
      url = aws_sqs_queue.registration.url
    }
    notification = {
      arn = aws_sqs_queue.notification.arn
      url = aws_sqs_queue.notification.url
    }
  }
}

resource "aws_sqs_queue_policy" "eventbridge" {
  for_each = local.payment_approved_targets

  queue_url = each.value.url
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowEventBridgePaymentApproved"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = each.value.arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_cloudwatch_event_rule.payment_approved.arn
        }
      }
    }]
  })
}

resource "aws_cloudwatch_event_target" "payment_approved" {
  for_each = local.payment_approved_targets

  event_bus_name = aws_cloudwatch_event_bus.domain.name
  rule           = aws_cloudwatch_event_rule.payment_approved.name
  target_id      = each.key
  arn            = each.value.arn

  depends_on = [aws_sqs_queue_policy.eventbridge]
}
