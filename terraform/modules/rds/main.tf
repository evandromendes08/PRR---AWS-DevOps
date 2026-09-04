resource "random_password" "db" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.project_name}/database"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = "app"
    password = random_password.db.result
  })
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-db"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "this" {
  identifier              = "${var.project_name}-postgres"
  engine                  = "postgres"
  engine_version          = "17"
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  max_allocated_storage   = 50
  storage_type            = "gp3"
  storage_encrypted       = var.storage_encrypted
  db_name                 = "events"
  username                = "app"
  password                = random_password.db.result
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [var.security_group_id]
  publicly_accessible     = false
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 1
  copy_tags_to_snapshot   = true
}
