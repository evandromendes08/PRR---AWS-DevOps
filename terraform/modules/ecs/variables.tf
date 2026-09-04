variable "project_name" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "service_repos" {
  type = map(string)
}

variable "services" {
  type = map(object({
    port = number
  }))
}

variable "target_group_arns" {
  description = "Map of ALB target group ARNs keyed by service name."
  type        = map(string)
}

variable "desired_count" {
  description = "Desired number of running tasks for each service."
  type        = number
  default     = 1
}

variable "image_tag" {
  description = "Container image tag to deploy from ECR."
  type        = string
  default     = "latest"
}

variable "aws_region" {
  description = "AWS region used by the ECS log driver."
  type        = string
}

variable "database_host" {
  description = "PostgreSQL endpoint reachable from the ECS tasks."
  type        = string
}

variable "database_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "events"
}

variable "database_secret_arn" {
  description = "Secrets Manager ARN containing the database username and password keys."
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito user pool used to validate access tokens."
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito app client accepted by the services."
  type        = string
}

variable "event_bus_name" {
  description = "EventBridge bus used for domain events."
  type        = string
}

variable "event_bus_arn" {
  description = "ARN of the EventBridge bus used for domain events."
  type        = string
}

variable "consumer_queues" {
  description = "SQS queues consumed by registration and notification services."
  type = map(object({
    arn = string
    url = string
  }))
}
