# Checklist para subir no GitHub

```bash
git init
git branch -M main
git add .
git commit -m "feat: initialize AWS DevOps event platform"
git remote add origin https://github.com/evandromendes08/PRR---AWS-DevOps.git
git push -u origin main
```

Antes do push, confirme que nenhum `backend.tf`, state file, `.env` ou credencial AWS foi versionado.
