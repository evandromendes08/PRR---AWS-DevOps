# Mensageria com EventBridge e SQS

O `payment-service` publica eventos no barramento de domínio quando um pagamento simulado é criado. A regra `PaymentApproved` distribui cada aprovação para duas filas independentes:

- a fila de inscrições é consumida pelo `registration-service`, que altera a inscrição para `PAID`;
- a fila de notificações é consumida pelo `notification-service`, que persiste uma notificação `QUEUED`.

Cada consumidor exclui a mensagem somente depois do processamento bem-sucedido. A notificação usa o identificador do evento EventBridge como chave idempotente, evitando duplicação quando o SQS redeliver uma mensagem.

## Configuração dos containers

| Variável | Serviço | Descrição |
|---|---|---|
| `MESSAGING_ENABLED` | payment, registration, notification | Ativa a integração quando definida como `true` |
| `AWS_REGION` | payment, registration, notification | Região do barramento e das filas |
| `EVENT_BUS_NAME` | payment | Barramento que recebe os eventos de pagamento |
| `SQS_QUEUE_URL` | registration, notification | Fila consumida pelo serviço |

No ECS, as permissões são fornecidas por task roles distintas e de menor privilégio. O pagamento pode apenas executar `events:PutEvents` no barramento do projeto; cada consumidor pode apenas receber e excluir mensagens de sua própria fila. Não há credenciais AWS estáticas nos containers.

No Docker Compose, `MESSAGING_ENABLED` permanece desativado. Assim, os testes locais não criam recursos externos nem dependem da AWS. A validação completa do fluxo assíncrono ocorre em DEV depois da aplicação do plano Terraform autorizado.

## Validação em DEV

Em 4 de setembro de 2026, o fluxo foi validado ponta a ponta pela URL do CloudFront com autenticação Cognito:

1. uma inscrição foi criada como `PENDING_PAYMENT`;
2. o pagamento aprovado retornou `eventPublished=true`;
3. o EventBridge entregou o evento às duas filas;
4. o `registration-service` alterou a inscrição para `PAID`;
5. o `notification-service` persistiu a notificação com o ID do evento;
6. as duas filas terminaram sem mensagens disponíveis, em processamento ou atrasadas.

O usuário Cognito temporário foi removido ao final, os três serviços permaneceram com uma task saudável e o plano Terraform posterior não apresentou mudanças.

## Limitações conhecidas

- O envio de e-mail por SES ainda não está ativo; a notificação permanece com status `QUEUED`.
- As filas ainda não possuem DLQ nem alarme de mensagens não processadas.
- Para uma carga de produção, a gravação do pagamento e a publicação devem adotar o padrão transactional outbox.
