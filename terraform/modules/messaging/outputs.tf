output "registration_queue_url" { value = aws_sqs_queue.registration.url }
output "registration_queue_arn" { value = aws_sqs_queue.registration.arn }
output "notification_queue_url" { value = aws_sqs_queue.notification.url }
output "notification_queue_arn" { value = aws_sqs_queue.notification.arn }
output "event_bus_name" { value = aws_cloudwatch_event_bus.domain.name }
output "event_bus_arn" { value = aws_cloudwatch_event_bus.domain.arn }
