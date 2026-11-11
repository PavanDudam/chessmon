# Chessmon API — FastAPI + Stockfish + Piper
FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates tar \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Stockfish (linux x86-64)
RUN mkdir -p /app/bin \
    && curl -fsSL -o /tmp/sf.tar \
      "https://github.com/official-stockfish/Stockfish/releases/download/sf_17/stockfish-ubuntu-x86-64-avx2.tar" \
    && mkdir -p /tmp/sf && tar -xf /tmp/sf.tar -C /tmp/sf \
    && SF_BIN="$(find /tmp/sf -type f -name 'stockfish*' ! -name '*.tar' | head -n 1)" \
    && cp "$SF_BIN" /app/bin/stockfish \
    && chmod +x /app/bin/stockfish \
    && rm -rf /tmp/sf /tmp/sf.tar

# Piper runtime + en_US-lessac-medium voice
RUN curl -fsSL -o /tmp/piper.tar.gz \
      "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz" \
    && mkdir -p /tmp/piper && tar -xzf /tmp/piper.tar.gz -C /tmp/piper \
    && mkdir -p /app/bin/piper \
    && if [ -d /tmp/piper/piper ]; then cp -a /tmp/piper/piper/. /app/bin/piper/; \
       else cp -a /tmp/piper/. /app/bin/piper/; fi \
    && chmod +x /app/bin/piper/piper \
    && curl -fsSL -o /app/bin/piper/en_US-lessac-medium.onnx \
      "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx" \
    && curl -fsSL -o /app/bin/piper/en_US-lessac-medium.onnx.json \
      "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" \
    && rm -rf /tmp/piper /tmp/piper.tar.gz

ENV STOCKFISH_PATH=/app/bin/stockfish \
    PIPER_BIN=/app/bin/piper/piper \
    PIPER_MODEL=en_US-lessac-medium \
    PIPER_MODEL_PATH=/app/bin/piper/en_US-lessac-medium.onnx \
    LD_LIBRARY_PATH=/app/bin/piper \
    ENGINE_POOL_SIZE=1 \
    ENGINE_HASH_MB=64 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
