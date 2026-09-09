# Event Service

Microserviço demonstrativo do Sistema de Gerenciamento de Eventos.

Endpoints: `GET /health`, `GET /events`, `POST /events` e `POST /events/:id/status`.

Com PostgreSQL habilitado, a criação do evento e do estoque inicial ocorre na mesma transação.
O endpoint de status recebe `{ "active": false }` ou `{ "active": true }`; a desativação preserva o histórico e impede novas reservas.
