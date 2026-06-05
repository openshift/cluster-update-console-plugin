FROM registry.ci.openshift.org/ocp/builder:rhel-9-base-nodejs-openshift-5.0 AS build
USER root

ENV CYPRESS_INSTALL_BINARY=0

ADD . /usr/src/app
WORKDIR /usr/src/app

RUN LOCAL_YARN="node $(awk '/yarnPath:/{print $2}' .yarnrc.yml)" && \
    $LOCAL_YARN install --immutable && $LOCAL_YARN build

FROM registry.ci.openshift.org/ocp/5.0:base-rhel9

COPY --from=build /usr/src/app/dist /usr/share/nginx/html
USER 1001

ENTRYPOINT ["nginx", "-g", "daemon off;"]
