FROM registry.access.redhat.com/ubi9/nodejs-22:latest AS build
USER root

ENV CYPRESS_INSTALL_BINARY=0

ADD . /usr/src/app
WORKDIR /usr/src/app

RUN LOCAL_YARN="node $(awk '/yarnPath:/{print $2}' .yarnrc.yml)" && \
    $LOCAL_YARN install --immutable && $LOCAL_YARN build

FROM registry.access.redhat.com/ubi9-minimal

USER 0

RUN microdnf install -y nginx && microdnf clean all

COPY --from=build /usr/src/app/dist /usr/share/nginx/html

RUN mkdir -p /tmp/nginx && \
    chgrp -R 0 /var/log/nginx /var/lib/nginx /usr/share/nginx/html /tmp/nginx && \
    chmod -R g=u /var/log/nginx /var/lib/nginx /usr/share/nginx/html /tmp/nginx

USER 1001

ENTRYPOINT ["nginx", "-g", "daemon off;", "-e", "stderr"]
