FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Dirección pública de la API tal como la ve el navegador. Se fija al compilar:
# en Railway se define como variable del servicio (VITE_API_URL).
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
# nginx sustituye ${PORT} en las plantillas de /etc/nginx/templates al arrancar.
ENV PORT=80
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
