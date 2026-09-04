# Notification Service

Microserviço demonstrativo do Sistema de Gerenciamento de Eventos.

Endpoints: `GET /health`, `GET /notifications` e `POST /notifications`.

Com `MESSAGING_ENABLED=true`, o serviço consome a fila informada em `SQS_QUEUE_URL`. Cada evento `PaymentApproved` cria de forma idempotente uma notificação `QUEUED`. O envio real por SES permanece como evolução.
