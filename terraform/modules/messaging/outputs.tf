output "registration_queue_url" { value = aws_sqs_queue.registration.url }
output "notification_queue_url" { value = aws_sqs_queue.notification.url }
output "event_bus_name" { value = aws_cloudwatch_event_bus.domain.name }
