FROM node:22-bookworm

ARG TARGETARCH
ARG TERRAFORM_VERSION=1.13.5

ENV DEBIAN_FRONTEND=noninteractive
ENV AWS_PAGER=""
ENV TF_IN_AUTOMATION=false
ENV CHECKPOINT_DISABLE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates curl git gnupg groff jq less openssh-client \
    postgresql-client unzip zip \
    && rm -rf /var/lib/apt/lists/*

RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

RUN case "${TARGETARCH}" in \
      "arm64") TF_ARCH="arm64" ;; \
      "amd64") TF_ARCH="amd64" ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
    esac \
    && curl -fsSLo /tmp/terraform.zip "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_${TF_ARCH}.zip" \
    && unzip /tmp/terraform.zip -d /usr/local/bin \
    && chmod +x /usr/local/bin/terraform \
    && rm -f /tmp/terraform.zip

RUN case "${TARGETARCH}" in \
      "arm64") AWS_ARCH="aarch64" ;; \
      "amd64") AWS_ARCH="x86_64" ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
    esac \
    && curl -fsSLo /tmp/awscliv2.zip "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" \
    && unzip -q /tmp/awscliv2.zip -d /tmp \
    && /tmp/aws/install \
    && rm -rf /tmp/aws /tmp/awscliv2.zip

WORKDIR /workspace

COPY devops/entrypoint.sh /usr/local/bin/devops-entrypoint
RUN chmod +x /usr/local/bin/devops-entrypoint

ENTRYPOINT ["devops-entrypoint"]
CMD ["bash"]
