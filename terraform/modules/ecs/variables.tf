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
