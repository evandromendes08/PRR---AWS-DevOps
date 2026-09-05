# Notification Service

Microserviço demonstrativo do Sistema de Gerenciamento de Eventos.

Endpoints: `GET /health`, `GET /notifications` e `POST /notifications`.

Com `MESSAGING_ENABLED=true`, o serviço consome a fila informada em `SQS_QUEUE_URL`. Cada evento `PaymentApproved` cria uma notificação de forma idempotente.

O envio real usa a API SES v2 diretamente pela task role do ECS e não depende de credenciais estáticas. Ele permanece desativado por padrão para que o ambiente local não faça chamadas externas. Para ativá-lo, configure:

| Variável | Descrição |
|---|---|
| `SES_ENABLED=true` | Ativa o envio após o consumo do evento |
| `AWS_REGION` | Região da identidade SES |
| `SES_FROM_EMAIL` | Remetente verificado no SES |
| `SES_TO_EMAIL` | Um ou mais destinatários separados por vírgula |

Enquanto a conta SES estiver no sandbox, remetentes e destinatários também precisam ser identidades verificadas. Uma entrega bem-sucedida grava `SENT`, o identificador retornado pelo provedor e o horário; uma falha grava `FAILED` e mantém a mensagem no fluxo de retry/DLQ do SQS.
