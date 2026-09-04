variable "project_name" { type = string }
variable "github_oidc_subject_repository" {
  type        = string
  description = "Repository component emitted in the GitHub OIDC sub claim, including immutable owner and repository IDs when configured by GitHub."
}
