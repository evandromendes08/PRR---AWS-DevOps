#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-evandro}"
REGION="${AWS_REGION:-us-east-1}"

ACCOUNT_ID="$(aws sts get-caller-identity --profile "${PROFILE}" --query Account --output text)"
BUCKET="prr-aws-devops-tfstate-${ACCOUNT_ID}-${REGION}"

echo "AWS profile : ${PROFILE}"
echo "AWS account : ${ACCOUNT_ID}"
echo "AWS region  : ${REGION}"
echo "State bucket: ${BUCKET}"

if aws s3api head-bucket --bucket "${BUCKET}" --profile "${PROFILE}" 2>/dev/null; then
  echo "Bucket already exists and is accessible."
else
  echo "Creating S3 state bucket..."
  if [[ "${REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${REGION}" \
      --profile "${PROFILE}" >/dev/null
  else
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${REGION}" \
      --create-bucket-configuration "LocationConstraint=${REGION}" \
      --profile "${PROFILE}" >/dev/null
  fi
fi

aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled \
  --profile "${PROFILE}"

aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
  --profile "${PROFILE}"

aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --profile "${PROFILE}"

cat > terraform/environments/dev/backend.hcl <<EOF
bucket       = "${BUCKET}"
key          = "event-management/dev/terraform.tfstate"
region       = "${REGION}"
use_lockfile = true
encrypt      = true
EOF

cat > terraform/environments/prod/backend.hcl <<EOF
bucket       = "${BUCKET}"
key          = "event-management/prod/terraform.tfstate"
region       = "${REGION}"
use_lockfile = true
encrypt      = true
EOF

echo "Backend bootstrap completed."
