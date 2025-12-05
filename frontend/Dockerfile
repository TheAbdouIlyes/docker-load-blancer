# Stage 1: Build Vite app
FROM node:20 AS builder
WORKDIR /app
COPY react-src/package*.json ./
RUN npm ci
COPY react-src/ ./
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
