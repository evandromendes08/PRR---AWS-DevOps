resource "aws_lb" "this" {
  name               = substr("${var.project_name}-alb", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "service" {
  for_each = var.services

  name        = substr("${var.project_name}-${each.key}", 0, 32)
  port        = each.value.port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service["event"].arn
  }
}

locals {
  path_services = {
    ticket       = ["/tickets*", "/tickets/*", "/api/tickets*", "/api/tickets/*"]
    registration = ["/registrations*", "/registrations/*", "/api/registrations*", "/api/registrations/*"]
    payment      = ["/payments*", "/payments/*", "/api/payments*", "/api/payments/*"]
    notification = ["/notifications*", "/notifications/*", "/api/notifications*", "/api/notifications/*"]
  }
}

resource "aws_lb_listener_rule" "service" {
  for_each = local.path_services

  listener_arn = aws_lb_listener.http.arn
  priority     = index(keys(local.path_services), each.key) + 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service[each.key].arn
  }

  condition {
    path_pattern {
      values = each.value
    }
  }
}
