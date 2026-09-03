resource "aws_sqs_queue" "registration" {
  name                       = "${var.project_name}-registration"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
}

resource "aws_sqs_queue" "notification" {
  name                       = "${var.project_name}-notification"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
}

resource "aws_cloudwatch_event_bus" "domain" {
  name = "${var.project_name}-domain"
}
