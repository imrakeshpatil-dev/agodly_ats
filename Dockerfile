# Single-image build for the Agodly ATS Next.js app.
FROM node:20-alpine AS build
WORKDIR /app
# Build tools for the better-sqlite3 native module.
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Copy the built app with its node_modules (includes the generated Prisma client
# and the compiled better-sqlite3 binary).
COPY --from=build /app ./
EXPOSE 3000
# `prestart` runs `prisma migrate deploy` before `next start`.
CMD ["npm", "run", "start"]
