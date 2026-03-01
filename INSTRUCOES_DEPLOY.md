# Passo a Passo: Hospedagem Move Plus (Vercel + Supabase)

Este guia detalha todos os passos necessários para colocar o teu projeto online, utilizando o Vercel para o frontend e backend (Serverless API) e o Supabase para a Base de Dados (PostgreSQL).

## 1. Preparar o Repositório no GitHub

Para o Vercel fazer a hospedagem, o teu código precisa de estar no GitHub.

1. Cria uma conta e faz login no [GitHub](https://github.com/).
2. Cria um novo repositório vazio (ex: `moveplus-ecommerce`).
3. No terminal do teu projeto local (no VSCode, por exemplo), corre os comandos:
   ```bash
   git init
   git add .
   git commit -m "Primeiro commit - Preparado para deploy"
   git branch -M main
   git remote add origin https://github.com/Deedzera/moveplus-ecommerce.git
   git push -u origin main
   ```

## 2. Criar a Base de Dados no Supabase

1. Cria uma conta e faz login no [Supabase](https://supabase.com/).
2. Clica em **New Project** e preenche os dados (Nome, Password da Base de Dados, Região). **Guarda bem a password da base de dados!**
3. Aguarda que o projeto seja provisionado (pode demorar uns minutos).
4. No menu lateral, vai a **SQL Editor** -> **New query**.
5. Abre o teu ficheiro local `database/init.sql`, copia todo o conteúdo e cola no SQL Editor do Supabase.
6. Clica em **Run** para criar todas as tabelas e dados iniciais da tua loja.
7. Vai a **Project Settings** (ícone da engrenagem) -> **Database**.
8. Desce até à secção **Connection Parameters** (ou Connection String). O nosso código precisa das variáveis individuais, por isso deves anotar o seguinte:
   - **DB_HOST**: Geralmente é algo como `aws-0-eu-central-1.pooler.supabase.com`
   - **DB_PORT**: `6543` (se usares connection pooling) ou `5432`
   - **DB_USER**: Ex: `postgres.[teu-id]`
   - **DB_NAME**: `postgres`
   - **DB_PASSWORD**: A senha que criaste no passo 2

## 3. Fazer o Deploy no Vercel

1. Cria uma conta e faz login na [Vercel](https://vercel.com/) (podes entrar com a tua conta do GitHub).
2. No painel de controlo (Dashboard), clica em **Add New...** -> **Project**.
3. Associa a tua conta do GitHub e clica em **Import** no repositório `moveplus-ecommerce`.
4. Na secção **Configure Project**:
   - **Framework Preset**: Deixa em `Other`.
   - **Root Directory**: Deixa como está (`./`).
   - Abres o menu **Environment Variables** e adicionas as tuas variáveis de ambiente. Precisarás de espelhar o que tens no teu ficheiro local `.env`.
5. **Adiciona as seguintes Variáveis de Ambiente:**
   - `DB_HOST`: (O host que copiaste do Supabase)
   - `DB_PORT`: (Geralmente 6543)
   - `DB_USER`: (O user do Supabase)
   - `DB_PASSWORD`: (A tua password do Supabase)
   - `DB_NAME`: postgres
   - `JWT_SECRET`: (Uma chave secreta complexa para os logins, inventa uma)
   - `CLOUDINARY_CLOUD_NAME`: (O teu nome configurado no Cloudinary)
   - `CLOUDINARY_API_KEY`: (A tua API Key do Cloudinary)
   - `CLOUDINARY_API_SECRET`: (A tua API Secret do Cloudinary)
6. Depois de adicionares todas as variáveis uma por uma, clica em **Deploy**.
7. A Vercel vai ler o teu ficheiro `vercel.json` e construir as tuas serverless functions e o site estático automaticamente.
8. Quando o deploy terminar, a Vercel vai gerar os URLs públicos da tua loja (ex: `https://moveplus-ecommerce.vercel.app`).

## 4. Testar a Plataforma

1. Clica no link gerado pela Vercel.
2. O teu frontend deverá carregar com sucesso. As imagens geridas pelo Cloudinary aparecerão normalmente.
3. Vai aos produtos ou faz login para testar a comunicação segura com a Base de Dados Serverless do Supabase.

---

💡 **Dica de atualizações futuras:** Sempre que alterares o código no teu computador, só precisas de gravar e correr no terminal:

```bash
git add .
git commit -m "Descrição das alteraçoes"
git push
```

A Vercel deteta a mudança no teu GitHub e atualiza o teu site hospedado de forma 100% automática!
