# Payment Service

Microserviço demonstrativo do Sistema de Gerenciamento de Eventos.

Endpoints: `GET /health` e `POST /payments`.

O pagamento permanece simulado, com resultado `APPROVED` ou `DECLINED`.

Com `MESSAGING_ENABLED=true`, o serviço publica `PaymentApproved` ou `PaymentDeclined` no barramento indicado por `EVENT_BUS_NAME`. A publicação usa a task role do ECS e não requer credenciais estáticas.
