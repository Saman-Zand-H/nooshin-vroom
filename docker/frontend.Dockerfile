FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY . .
ARG VITE_BASE_PATH=/
ARG VITE_DJANGO_SAME_ORIGIN=true
ENV VITE_BASE_PATH=$VITE_BASE_PATH \
    VITE_DJANGO_SAME_ORIGIN=$VITE_DJANGO_SAME_ORIGIN \
    VITE_LOCAL_PREVIEW=false \
    VITE_DJANGO_API_URL=
RUN npm run build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
