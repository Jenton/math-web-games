# Local tool image for the Kenney bundle browser. Not part of the game or its deploy.
FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY build-manifest.js serve.js index.html ./
ENV KENNEY_BUNDLE=/bundle HOST=0.0.0.0
EXPOSE 8765
CMD ["node", "serve.js"]
