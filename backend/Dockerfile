FROM python:3.12-slim

WORKDIR /app

# Instalar uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Copiar arquivos de dependências
COPY pyproject.toml uv.lock ./

# Instalar dependências (sem dev)
RUN uv sync --frozen --no-dev

# Copiar código
COPY app/ ./app/

# Expor porta
EXPOSE 8000

# Rodar com uv
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
