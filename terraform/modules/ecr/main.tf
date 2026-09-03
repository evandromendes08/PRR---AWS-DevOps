resource "aws_ecr_repository" "service" {
  for_each = var.services

  name                 = "${var.project_name}/${each.key}-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}
