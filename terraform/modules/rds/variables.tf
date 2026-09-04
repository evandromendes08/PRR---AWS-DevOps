variable "project_name" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }

variable "storage_encrypted" {
  description = "Encrypt storage for new database instances. Changing an existing unencrypted instance requires replacement."
  type        = bool
  default     = true
}
