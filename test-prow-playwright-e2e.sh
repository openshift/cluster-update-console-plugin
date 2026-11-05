#!/usr/bin/env bash

set -exuo pipefail

ARTIFACT_DIR=${ARTIFACT_DIR:=/tmp/artifacts}
SCREENSHOTS_DIR=playwright-tests/screenshots
INSTALLER_DIR=${INSTALLER_DIR:=${ARTIFACT_DIR}/installer}
OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE:-openshift-lightspeed}"
PLUGIN_NAMESPACE="${PLUGIN_NAMESPACE:-cluster-update-console-plugin}"

function copyArtifacts {
  if [ -d "$ARTIFACT_DIR" ] && [ -d "$SCREENSHOTS_DIR" ]; then
    if [[ -z "$(ls -A -- "$SCREENSHOTS_DIR")" ]]; then
      echo "No artifacts were copied from screenshots."
    else
      echo "Copying Playwright screenshots from $(pwd)..."
      cp -r "$SCREENSHOTS_DIR" "${ARTIFACT_DIR}/playwright-screenshots"
    fi
  fi

  # Collect cluster artifacts for debugging
  echo "Collecting cluster artifacts..."
  oc get proposals -A -o yaml > "${ARTIFACT_DIR}/proposals.yaml" 2>/dev/null || true
  oc get pods -n "${OPERATOR_NAMESPACE}" -o yaml > "${ARTIFACT_DIR}/operator-pods.yaml" 2>/dev/null || true
  oc get pods -n "${PLUGIN_NAMESPACE}" -o yaml > "${ARTIFACT_DIR}/plugin-pods.yaml" 2>/dev/null || true
  oc logs -n "${OPERATOR_NAMESPACE}" deployment/controller-manager --tail=500 > "${ARTIFACT_DIR}/operator-logs.txt" 2>/dev/null || true
  oc logs -n "${PLUGIN_NAMESPACE}" deployment/cluster-update-console-plugin --tail=500 > "${ARTIFACT_DIR}/plugin-logs.txt" 2>/dev/null || true
  oc get consoles.operator.openshift.io cluster -o yaml > "${ARTIFACT_DIR}/console-config.yaml" 2>/dev/null || true
}

trap copyArtifacts EXIT

# --- 1. Validate required inputs ---
if [ -z "${PLUGIN_IMAGE:-}" ]; then
  echo "ERROR: PLUGIN_IMAGE is not set. This should be provided by ci-operator dependencies."
  exit 1
fi

if [ -z "${OPERATOR_IMAGE:-}" ]; then
  echo "ERROR: OPERATOR_IMAGE is not set. This should be provided by ci-operator dependencies."
  exit 1
fi

# --- 2. Install lightspeed-agentic-operator with mock agent ---
echo "=== Cloning lightspeed-agentic-operator repository ==="
git clone --depth=1 https://github.com/openshift/lightspeed-agentic-operator.git /tmp/operator
cd /tmp/operator

echo "=== Installing lightspeed-agentic-operator with mock agent ==="
echo "Using operator image: ${OPERATOR_IMAGE}"
IMG="${OPERATOR_IMAGE}" \
SANDBOX_IMAGE="quay.io/openshift-lightspeed/ols-qe:lightspeed-mock-agent1" \
OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE}" \
SANDBOX_MODE="bare-pod" \
bash .tekton/integration-tests/scripts/install-operator.sh

cd -

# --- 3. Deploy the plugin from PLUGIN_IMAGE ---
echo "=== Deploying cluster-update-console-plugin from ${PLUGIN_IMAGE} ==="

helm upgrade -i cluster-update-console-plugin charts/openshift-console-plugin \
  -n "${PLUGIN_NAMESPACE}" \
  --create-namespace \
  --set plugin.image="${PLUGIN_IMAGE}"

echo "=== Waiting for plugin deployment to be ready ==="
oc rollout status deployment/cluster-update-console-plugin \
  -n "${PLUGIN_NAMESPACE}" \
  --timeout=120s

# --- 4. Verify plugin is enabled (Helm chart hook should handle this) ---
echo "=== Verifying plugin is enabled in console ==="
# The Helm chart's post-install hook should enable the plugin automatically.
# This is just verification with a fallback in case the hook didn't run.
CURRENT_PLUGINS=$(oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null || echo "[]")
if ! echo "${CURRENT_PLUGINS}" | grep -q "cluster-update-console-plugin"; then
  echo "Plugin not enabled by chart hook, enabling manually as fallback..."
  oc patch consoles.operator.openshift.io cluster \
    --type=json \
    -p '[{"op":"test","path":"/spec/plugins","value":null},{"op":"add","path":"/spec/plugins","value":[]}]' 2>/dev/null || true
  oc patch consoles.operator.openshift.io cluster \
    --type=json \
    -p '[{"op":"add","path":"/spec/plugins/-","value":"cluster-update-console-plugin"}]'
  echo "Plugin enabled, waiting for console to reload..."
  sleep 30
else
  echo "Plugin already enabled by chart hook"
fi

# --- 5. Set up environment for Playwright tests ---
# don't log kubeadmin-password
set +x
LOGIN_PASSWORD="$(cat "${KUBEADMIN_PASSWORD_FILE:-${INSTALLER_DIR}/auth/kubeadmin-password}")"
export LOGIN_PASSWORD
set -x
BASE_URL="$(oc get consoles.config.openshift.io cluster -o jsonpath='{.status.consoleURL}')"
export BASE_URL
export LOGIN_USERNAME="${LOGIN_USERNAME:-kubeadmin}"
export LOGIN_IDP="${LOGIN_IDP:-kube:admin}"
export KUBECONFIG_PATH="${KUBECONFIG:-${HOME}/.kube/config}"

echo "=== Installing Node dependencies ==="
if [ ! -d node_modules ]; then
  yarn install --immutable
fi

echo "=== Installing Playwright browsers ==="
yarn playwright install --with-deps chromium

# --- 6. Run Playwright tests ---
echo "=== Running Playwright tests in headless mode ==="
yarn test-playwright-headless

echo "=== Playwright E2E tests complete ==="
