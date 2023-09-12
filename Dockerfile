# syntax=docker/dockerfile:1
ARG APP_DIRECTORY=/home/node/app

# ---- Base Node ----
FROM node:lts-slim AS base
  # tell we are building code for production
  ENV NODE_ENV production
  # install PNPM (https://github.com/pnpm/pnpm/issues/4495)
  ENV PNPM_HOME="/root/.local/share/pnpm"
  ENV PATH="${PATH}:${PNPM_HOME}"
  RUN npm i -g pnpm
  # tells we run transpiler by default
  ENTRYPOINT ["node"]
  # pre-expose default service port
  EXPOSE 3000

# ---- Dependencies ----
FROM base AS dependencies
  ARG APP_DIRECTORY
  # Define workdir for "pnpm install"
  WORKDIR $APP_DIRECTORY
  # Copy only package.json to allow efficient caching of node_modules after installation
  COPY package.json .
  # ...fetch deps (will NOT install any devDependencies https://classic.yarnpkg.com/lang/en/docs/cli/install/#toc-yarn-install-production-true-false)
  # "tsconfig-paths" MUST BE in "dependencies" and not "devDependencies" (required for runtime)
  RUN pnpm install

# ---- Release ----
FROM dependencies AS release
  ARG APP_DIRECTORY
  # Define scripts as context folder
  WORKDIR $APP_DIRECTORY/dist
  #
  # run server script by default on top of Typescript transpiler (https://www.bmc.com/blogs/docker-cmd-vs-entrypoint/)
  CMD ["app"]
  # ... finally, move all files/folders from repo copy EXCEPT what is defined in repo's .dockerignore (https://stackoverflow.com/a/62164551)
  # side note : we do that as the last step so subsequent rebuilds are faster
  COPY . $APP_DIRECTORY
