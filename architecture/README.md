# Arquitetura

Esta pasta contém a documentação e os diagramas da solução.

- `architecture.md`: especificação técnica.
- `architecture.svg`: diagrama vetorial.
- `architecture.png`: diagrama para apresentação.

Regere os formatos publicados após alterar o arquivo-fonte:

```bash
docker compose run --rm --no-deps toolbox sh -lc \
  'dot -Tsvg architecture/architecture.dot -o architecture/architecture.svg && dot -Tpng architecture/architecture.dot -o architecture/architecture.png'
```
