variable "aws_region" {
  description = "AWS region used by the environment."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "event-management"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "ecs_desired_count" {
  description = "Desired task count per ECS microservice. Use 0 only during the first infrastructure bootstrap before images exist in ECR."
  type        = number
  default     = 1

  validation {
    condition     = var.ecs_desired_count >= 0
    error_message = "ecs_desired_count must be zero or greater."
  }
}

variable "ecs_image_tag" {
  description = "Docker image tag deployed by ECS."
  type        = string
  default     = "latest"
}
