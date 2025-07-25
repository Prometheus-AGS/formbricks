FROM node:22-alpine3.21 AS base

#
## step 1: Prune monorepo
#
# FROM base AS builder
# RUN apk add --no-cache libc6-compat
# RUN apk update
# Set working directory
# WORKDIR /app
# RUN yarn global add turbo
# COPY . .
# RUN turbo prune @formbricks/web --docker

#
## step 2: Install & build
#
FROM base AS installer

# Enable corepack and prepare pnpm
RUN npm install --ignore-scripts -g corepack@latest 
RUN corepack enable
RUN corepack prepare pnpm@9.15.9 --activate

# Install necessary build tools and compilers
RUN apk update && apk add --no-cache cmake g++ gcc jq make openssl-dev python3

# Copy the secrets handling script
COPY apps/web/scripts/docker/read-secrets.sh /tmp/read-secrets.sh
RUN chmod +x /tmp/read-secrets.sh

# Accept build arguments for required environment variables
ARG DATABASE_URL
ARG ENCRYPTION_KEY

# Set environment variables from build args
ENV DATABASE_URL=${DATABASE_URL}
ENV ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Increase Node.js memory limit as a regular build argument
ARG NODE_OPTIONS="--max_old_space_size=4096"
ENV NODE_OPTIONS=${NODE_OPTIONS}

# Set the working directory
WORKDIR /app

# Copy the package information
# COPY .gitignore .gitignore
# COPY --from=builder /app/out/json/ .
# COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Prepare the build
COPY . .

# Create a .env file
RUN touch apps/web/.env

# Install the dependencies
RUN pnpm install --ignore-scripts

# Build the database package first
RUN pnpm build --filter=@formbricks/database

# Build the project - environment variables are already set from build args
RUN pnpm build --filter=@formbricks/web...

# Extract Prisma version
RUN jq -r '.devDependencies.prisma' packages/database/package.json > /prisma_version.txt

#
## step 3: setup production runner
#
FROM base AS runner

RUN npm install --ignore-scripts -g corepack@latest 
RUN corepack enable

RUN apk add --no-cache curl \
    && apk add --no-cache supercronic \
    # && addgroup --system --gid 1001 nodejs \
    && addgroup -S nextjs \
    && adduser -S -u 1001 -G nextjs nextjs

WORKDIR /home/nextjs

# Ensure no write permissions are assigned to the copied resources
COPY --from=installer /app/apps/web/.next/standalone ./
RUN chown -R nextjs:nextjs ./ && chmod -R 755 ./

COPY --from=installer /app/apps/web/next.config.mjs .
RUN chmod 644 ./next.config.mjs

COPY --from=installer /app/apps/web/package.json .
RUN chmod 644 ./package.json

COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
RUN chown -R nextjs:nextjs ./apps/web/.next/static && chmod -R 755 ./apps/web/.next/static

COPY --from=installer /app/apps/web/public ./apps/web/public
RUN chown -R nextjs:nextjs ./apps/web/public && chmod -R 755 ./apps/web/public

COPY --from=installer /app/packages/database/schema.prisma ./packages/database/schema.prisma
RUN chown nextjs:nextjs ./packages/database/schema.prisma && chmod 644 ./packages/database/schema.prisma

COPY --from=installer /app/packages/database/dist ./packages/database/dist
RUN chown -R nextjs:nextjs ./packages/database/dist && chmod -R 755 ./packages/database/dist

COPY --from=installer /app/node_modules/@prisma/client ./node_modules/@prisma/client
RUN chown -R nextjs:nextjs ./node_modules/@prisma/client && chmod -R 755 ./node_modules/@prisma/client

COPY --from=installer /app/node_modules/.prisma ./node_modules/.prisma
RUN chown -R nextjs:nextjs ./node_modules/.prisma && chmod -R 755 ./node_modules/.prisma

COPY --from=installer /prisma_version.txt .
RUN chown nextjs:nextjs ./prisma_version.txt && chmod 644 ./prisma_version.txt

COPY /docker/cronjobs /app/docker/cronjobs
RUN chmod -R 755 /app/docker/cronjobs

COPY --from=installer /app/node_modules/@paralleldrive/cuid2 ./node_modules/@paralleldrive/cuid2
RUN chmod -R 755 ./node_modules/@paralleldrive/cuid2

COPY --from=installer /app/node_modules/@noble/hashes ./node_modules/@noble/hashes
RUN chmod -R 755 ./node_modules/@noble/hashes

COPY --from=installer /app/node_modules/zod ./node_modules/zod
RUN chmod -R 755 ./node_modules/zod

RUN npm install -g prisma

# Create a startup script to handle the conditional logic
COPY --from=installer /app/apps/web/scripts/docker/next-start.sh /home/nextjs/start.sh
RUN chown nextjs:nextjs /home/nextjs/start.sh && chmod +x /home/nextjs/start.sh

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
USER nextjs

# Prepare volume for uploads
RUN mkdir -p /home/nextjs/apps/web/uploads/
VOLUME /home/nextjs/apps/web/uploads/

# Prepare volume for SAML preloaded connection
RUN mkdir -p /home/nextjs/apps/web/saml-connection
VOLUME /home/nextjs/apps/web/saml-connection

CMD ["/home/nextjs/start.sh"]
