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
