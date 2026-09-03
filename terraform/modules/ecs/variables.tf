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
