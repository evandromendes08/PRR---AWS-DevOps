# Registration Service

Microserviço demonstrativo do Sistema de Gerenciamento de Eventos.

Endpoints: `GET /health`, `GET /registrations` e `POST /registrations`.

Com `MESSAGING_ENABLED=true`, o serviço consome a fila informada em `SQS_QUEUE_URL`. Eventos `PaymentApproved` alteram a inscrição correspondente de `PENDING_PAYMENT` para `PAID`.
