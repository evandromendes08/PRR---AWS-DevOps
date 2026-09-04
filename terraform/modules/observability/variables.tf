variable "project_name" {
  type = string
}

variable "services" {
  type = set(string)
}

variable "load_balancer_arn_suffix" {
  type = string
}
