# Notification Service

Microserviço demonstrativo do Sistema de Gerenciamento de Eventos.

Endpoints: `GET /health` e `POST /notifications`.

Nesta etapa, a notificação é persistida como `QUEUED`; o consumidor SQS/SES será implementado separadamente.
