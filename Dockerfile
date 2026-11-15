# Official slim Node.js LTS base image
FROM node:20-slim

# Install Python 3, pip, and venv
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Setup Python Virtual Environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies first for caching
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r backend/requirements.txt

# Install Node dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm install --prefix backend && \
    npm install --prefix frontend

# Copy remaining source code
COPY . .

# Build React frontend
RUN npm run build --prefix frontend

# Expose application port
ENV PORT=5000
ENV PYTHON_EXECUTABLE=/opt/venv/bin/python
EXPOSE 5000

# Start server
CMD ["node", "backend/server.js"]
