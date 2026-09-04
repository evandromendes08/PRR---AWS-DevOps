# Frontend

Frontend estático demonstrativo servido pelo S3 através do CloudFront.

A aplicação utiliza `/api` como base da API, mantendo frontend e backend na mesma origem HTTPS do CloudFront.

O formulário de login utiliza o app client público do Amazon Cognito configurado em `config.js`. O access token é mantido somente durante a sessão da aba e enviado como Bearer token nas chamadas da API. Não há segredo de cliente no frontend.
