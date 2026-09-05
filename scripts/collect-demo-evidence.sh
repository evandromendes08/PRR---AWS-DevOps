#!/usr/bin/env bash
set -euo pipefail

DEMO_AWS_PROFILE="${DEMO_AWS_PROFILE:-evandro}"
DEMO_AWS_REGION="${DEMO_AWS_REGION:-us-east-1}"
DEMO_PREFIX="${DEMO_PREFIX:-event-management-dev}"
DEMO_CLOUDFRONT_URL="${DEMO_CLOUDFRONT_URL:-https://dr3ywy7rm7zik.cloudfront.net}"
DEMO_SERVICES=(event ticket registration payment notification)

section() {
  echo
  echo "## $1"
}

aws_demo() {
  aws --profile "${DEMO_AWS_PROFILE}" --region "${DEMO_AWS_REGION}" "$@"
}

section "Identidade AWS"
aws_demo sts get-caller-identity --output table

section "Serviços ECS"
ecs_service_names=()
for service in "${DEMO_SERVICES[@]}"; do
  ecs_service_names+=("${DEMO_PREFIX}-${service}")
done
aws_demo ecs describe-services \
  --cluster "${DEMO_PREFIX}-cluster" \
  --services "${ecs_service_names[@]}" \
  --query 'services[].{service:serviceName,desired:desiredCount,running:runningCount,status:status,rollout:deployments[0].rolloutState}' \
  --output table

section "Target groups do ALB"
for service in "${DEMO_SERVICES[@]}"; do
  target_group_name="${DEMO_PREFIX}-${service}"
  target_group_arn="$(aws_demo elbv2 describe-target-groups \
    --names "${target_group_name:0:32}" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)"
  aws_demo elbv2 describe-target-health \
    --target-group-arn "${target_group_arn}" \
    --query "TargetHealthDescriptions[].{service:'${service}',target:Target.Id,state:TargetHealth.State}" \
    --output table
done

section "Últimas imagens ECR"
for service in "${DEMO_SERVICES[@]}"; do
  repository="${DEMO_PREFIX}/${service}-service"
  aws_demo ecr describe-images \
    --repository-name "${repository}" \
    --query 'sort_by(imageDetails,& imagePushedAt)[-1].{repository:`'"${repository}"'`,pushed:imagePushedAt,digest:imageDigest}' \
    --output table
  aws_demo ecr describe-image-scan-findings \
    --repository-name "${repository}" \
    --image-id imageTag=latest \
    --query '{status:imageScanStatus.status,findings:imageScanFindings.findingSeverityCounts}' \
    --output table
done

section "Alarmes CloudWatch"
aws_demo cloudwatch describe-alarms \
  --alarm-name-prefix "${DEMO_PREFIX}" \
  --query 'MetricAlarms[].{alarm:AlarmName,state:StateValue,metric:MetricName}' \
  --output table

section "Filas SQS e DLQs"
queue_urls="$(aws_demo sqs list-queues \
  --queue-name-prefix "${DEMO_PREFIX}" \
  --query 'QueueUrls[]' \
  --output text)"
for queue_url in ${queue_urls}; do
  aws_demo sqs get-queue-attributes \
    --queue-url "${queue_url}" \
    --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible SqsManagedSseEnabled \
    --query '{queue:`'"${queue_url##*/}"'`,available:Attributes.ApproximateNumberOfMessages,inFlight:Attributes.ApproximateNumberOfMessagesNotVisible,encrypted:Attributes.SqsManagedSseEnabled}' \
    --output table
done

section "CloudFront e API"
curl --fail --silent --show-error --head "${DEMO_CLOUDFRONT_URL}/" | sed -n '1,20p'
curl --fail --silent --show-error "${DEMO_CLOUDFRONT_URL}/api/health"
echo

section "Revisão Git"
git status --short
git log -3 --oneline
