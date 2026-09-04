# Ticket Service

Microserviço demonstrativo do Sistema de Gerenciamento de Eventos.

Endpoints: `GET /health`, `GET /tickets/availability` e `POST /tickets/reserve`.

Reservas PostgreSQL usam locking de linha para impedir overselling.
