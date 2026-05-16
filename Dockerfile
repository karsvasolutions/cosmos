# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
# Install deps from the lockfile only — fastest reliable install.
COPY package*.json ./
RUN npm ci
# Copy the rest and build.
COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
# Static files only — no SSR.
COPY --from=build /app/dist /usr/share/nginx/html
# Single-page; otherwise default nginx config is fine.
EXPOSE 80
