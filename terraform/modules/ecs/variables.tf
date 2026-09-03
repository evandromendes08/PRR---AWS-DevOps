variable "project_name" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "service_repos" { type = map(string) }
variable "services" { type = map(object({ port = number })) }
