#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="prr-integration-test"
export POSTGRES_PORT="${POSTGRES_PORT:-15432}"
export EVENT_PORT="${EVENT_PORT:-3001}"
export TICKET_PORT="${TICKET_PORT:-3002}"
export REGISTRATION_PORT="${REGISTRATION_PORT:-3003}"
export PAYMENT_PORT="${PAYMENT_PORT:-3004}"
export NOTIFICATION_PORT="${NOTIFICATION_PORT:-3005}"
export AUTH_TEST_PORT="${AUTH_TEST_PORT:-3010}"

cleanup() {
  docker compose -p "${PROJECT_NAME}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose -p "${PROJECT_NAME}" up -d --build \
  postgres event-service ticket-service registration-service payment-service notification-service

for port in "${EVENT_PORT}" "${TICKET_PORT}" "${REGISTRATION_PORT}" "${PAYMENT_PORT}" "${NOTIFICATION_PORT}"; do
  ready=false
  for _ in {1..30}; do
    health="$(curl -fsS "http://127.0.0.1:${port}/health" 2>/dev/null || true)"
    if HEALTH_PAYLOAD="${health}" node -e '
      const health = JSON.parse(process.env.HEALTH_PAYLOAD || "{}");
      process.exit(health.status === "ok" && health.database?.status === "ok" ? 0 : 1);
    '; then
      ready=true
      break
    fi
    sleep 1
  done
  if [[ "${ready}" != "true" ]]; then
    docker compose -p "${PROJECT_NAME}" logs --no-color --tail=100
    echo "Service on port ${port} did not become healthy" >&2
    exit 1
  fi
done

for port in "${REGISTRATION_PORT}" "${PAYMENT_PORT}" "${NOTIFICATION_PORT}"; do
  health="$(curl -fsS "http://127.0.0.1:${port}/health")"
  HEALTH_PAYLOAD="${health}" node -e '
    const health = JSON.parse(process.env.HEALTH_PAYLOAD);
    if (health.messaging?.status !== "disabled") process.exit(1);
  '
done

notification_health="$(curl -fsS "http://127.0.0.1:${NOTIFICATION_PORT}/health")"
HEALTH_PAYLOAD="${notification_health}" node -e '
  const health = JSON.parse(process.env.HEALTH_PAYLOAD);
  if (health.email?.status !== "disabled") process.exit(1);
'

auth_container="$(docker compose -p "${PROJECT_NAME}" run --detach --no-deps \
  --publish "127.0.0.1:${AUTH_TEST_PORT}:3000" \
  -e AUTH_ENABLED=true \
  -e COGNITO_USER_POOL_ID=us-east-1_aaaaaaaaa \
  -e COGNITO_CLIENT_ID=local-test-client \
  event-service)"
for _ in {1..15}; do
  curl -fsS "http://127.0.0.1:${AUTH_TEST_PORT}/health" >/dev/null 2>&1 && break
  sleep 1
done
unauthorized_code="$(curl -sS -o /dev/null -w '%{http_code}' \
  "http://127.0.0.1:${AUTH_TEST_PORT}/api/events")"
docker rm --force "${auth_container}" >/dev/null
[[ "${unauthorized_code}" == "401" ]]

invalid_json_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/json' -d '{invalid' \
  "http://127.0.0.1:${EVENT_PORT}/api/events")"
invalid_quantity_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/json' -d '{"quantity":0}' \
  "http://127.0.0.1:${TICKET_PORT}/api/tickets/reserve")"
[[ "${invalid_json_code}" == "400" ]]
[[ "${invalid_quantity_code}" == "422" ]]

event="$(curl -fsS -X POST -H 'content-type: application/json' \
  -d '{"name":"Integration Test","city":"São Paulo","available":1}' \
  "http://127.0.0.1:${EVENT_PORT}/api/events")"
event_id="$(EVENT_PAYLOAD="${event}" node -e '
  process.stdout.write(JSON.parse(process.env.EVENT_PAYLOAD).id);
')"

availability="$(curl -fsS "http://127.0.0.1:${TICKET_PORT}/api/tickets/availability?eventId=${event_id}")"
AVAILABILITY_PAYLOAD="${availability}" node -e '
  const stock = JSON.parse(process.env.AVAILABILITY_PAYLOAD);
  if (stock.available !== 1 || stock.sold !== 0 || stock.active !== true) process.exit(1);
'

deactivated="$(curl -fsS -X POST -H 'content-type: application/json' \
  -d '{"active":false}' \
  "http://127.0.0.1:${EVENT_PORT}/api/events/${event_id}/status")"
EVENT_PAYLOAD="${deactivated}" node -e '
  const event = JSON.parse(process.env.EVENT_PAYLOAD);
  if (event.active !== false) process.exit(1);
'
inactive_availability="$(curl -fsS "http://127.0.0.1:${TICKET_PORT}/api/tickets/availability?eventId=${event_id}")"
AVAILABILITY_PAYLOAD="${inactive_availability}" node -e '
  const stock = JSON.parse(process.env.AVAILABILITY_PAYLOAD);
  if (stock.active !== false || stock.available !== 1 || stock.sold !== 0) process.exit(1);
'
inactive_reservation_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  -d "{\"eventId\":\"${event_id}\",\"quantity\":1}" \
  "http://127.0.0.1:${TICKET_PORT}/api/tickets/reserve")"
[[ "${inactive_reservation_code}" == "409" ]]
curl -fsS -X POST -H 'content-type: application/json' \
  -d '{"active":true}' \
  "http://127.0.0.1:${EVENT_PORT}/api/events/${event_id}/status" >/dev/null

temp_dir="$(mktemp -d)"
curl -sS -o "${temp_dir}/response-a" -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  -d "{\"eventId\":\"${event_id}\",\"quantity\":1}" \
  "http://127.0.0.1:${TICKET_PORT}/api/tickets/reserve" >"${temp_dir}/code-a" &
pid_a=$!
curl -sS -o "${temp_dir}/response-b" -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  -d "{\"eventId\":\"${event_id}\",\"quantity\":1}" \
  "http://127.0.0.1:${TICKET_PORT}/api/tickets/reserve" >"${temp_dir}/code-b" &
pid_b=$!
wait "${pid_a}" "${pid_b}"
codes="$(sort "${temp_dir}/code-a" "${temp_dir}/code-b" | tr '\n' ' ')"
if [[ "${codes}" != "201 409 " ]]; then
  echo "Expected concurrent reservation statuses 201 and 409; received ${codes}" >&2
  exit 1
fi
rm -f "${temp_dir}/response-a" "${temp_dir}/response-b" "${temp_dir}/code-a" "${temp_dir}/code-b"
rmdir "${temp_dir}"

registration="$(curl -fsS -X POST -H 'content-type: application/json' \
  -d "{\"eventId\":\"${event_id}\",\"participant\":\"Integration Test\"}" \
  "http://127.0.0.1:${REGISTRATION_PORT}/api/registrations")"
registration_id="$(REGISTRATION_PAYLOAD="${registration}" node -e '
  process.stdout.write(JSON.parse(process.env.REGISTRATION_PAYLOAD).id);
')"

docker compose -p "${PROJECT_NAME}" restart registration-service >/dev/null
for _ in {1..10}; do
  curl -fsS "http://127.0.0.1:${REGISTRATION_PORT}/health" >/dev/null 2>&1 && break
  sleep 1
done
registrations="$(curl -fsS "http://127.0.0.1:${REGISTRATION_PORT}/api/registrations")"
REGISTRATIONS_PAYLOAD="${registrations}" EXPECTED_ID="${registration_id}" node -e '
  const registrations = JSON.parse(process.env.REGISTRATIONS_PAYLOAD);
  if (!registrations.items.some(item => item.id === process.env.EXPECTED_ID)) process.exit(1);
'

payment="$(curl -fsS -X POST -H 'content-type: application/json' \
  -d "{\"registrationId\":\"${registration_id}\",\"amount\":75,\"approve\":true}" \
  "http://127.0.0.1:${PAYMENT_PORT}/api/payments")"
PAYMENT_PAYLOAD="${payment}" node -e '
  const payment = JSON.parse(process.env.PAYMENT_PAYLOAD);
  if (payment.status !== "APPROVED" || payment.eventPublished !== false) process.exit(1);
'
curl -fsS -X POST -H 'content-type: application/json' \
  -d '{"channel":"email","message":"Integration Test"}' \
  "http://127.0.0.1:${NOTIFICATION_PORT}/api/notifications" >/dev/null

counts="$(docker compose -p "${PROJECT_NAME}" exec -T postgres psql -U events -d events -Atc \
  "SELECT (SELECT count(*) FROM events),(SELECT count(*) FROM tickets),(SELECT count(*) FROM registrations),(SELECT count(*) FROM payments),(SELECT count(*) FROM notifications);")"

echo "Integration tests passed: health=5/5 auth=1/1 messaging-disabled=3/3 validation=2/2 event-lifecycle=deactivate/reactivate reservations='${codes}' table_counts=${counts}"
