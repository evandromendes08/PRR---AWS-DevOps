variable "email_address" {
  description = "Email address verified in SES for the academic demonstration."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.email_address))
    error_message = "email_address must be a valid email address."
  }
}
