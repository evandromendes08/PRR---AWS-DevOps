resource "aws_cloudwatch_log_group" "application" {
  name              = "/event-management/application"
  retention_in_days = 7
}
