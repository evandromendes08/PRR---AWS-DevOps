# Persistência PostgreSQL

Os cinco microserviços suportam PostgreSQL por meio do driver `pg`. Cada serviço cria suas tabelas de forma idempotente durante a inicialização.

## Configuração

| Variável | Descrição | Padrão |
|---|---|---|
| `DB_ENABLED` | Habilita PostgreSQL quando definida como `true` | `false` |
| `DB_HOST` | Endpoint PostgreSQL | — |
| `DB_PORT` | Porta PostgreSQL | `5432` |
| `DB_NAME` | Nome do banco | `events` |
| `DB_USER` | Usuário do banco | — |
| `DB_PASSWORD` | Senha do banco | — |
| `DB_SSL` | Habilita TLS quando definida como `true` | `false` |
| `DB_POOL_SIZE` | Máximo de conexões por container | `5` |

No ambiente ECS, usuário e senha são injetados diretamente do Secrets Manager e não ficam armazenados na task definition ou nos logs.

## Validação em DEV

A integração com o RDS e o Secrets Manager está ativa nas cinco task definitions DEV. Em 4 de setembro de 2026, os cinco serviços estabilizaram com uma task saudável cada e o fluxo público via CloudFront validou criação de evento, estoque, reserva, inscrição, pagamento e notificação com persistência no PostgreSQL.

## Tabelas

- `events`
- `tickets`
- `registrations`
- `payments`
- `notifications`

A reserva de ingressos utiliza transação e `SELECT ... FOR UPDATE`, garantindo que duas requisições concorrentes não vendam mais ingressos do que o estoque disponível.

## Teste local

Execute:

```bash
bash scripts/test-services.sh
```

O teste cria um projeto Compose isolado, valida os cinco health checks, persistência após reinício, criação dos registros e uma disputa de duas reservas pelo último ingresso. Containers, rede e volume temporários são removidos ao final.
