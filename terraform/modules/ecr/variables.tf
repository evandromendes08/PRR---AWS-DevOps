variable "project_name" { type = string }
variable "services" { type = map(object({ port = number })) }
