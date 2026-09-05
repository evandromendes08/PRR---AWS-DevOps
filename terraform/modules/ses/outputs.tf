output "identity_arn" {
  value = aws_sesv2_email_identity.this.arn
}

output "email_address" {
  value = aws_sesv2_email_identity.this.email_identity
}
