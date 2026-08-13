#!/usr/bin/env bash
set -uo pipefail

# ============================================================================
# Imboni — retry an Oracle A1 (Ampere) instance launch until capacity frees
# ============================================================================
# "Out of capacity for shape VM.Standard.A1.Flex" is not a configuration error.
# Oracle sells Always Free ARM cores out of whatever is left after paying
# customers, and in most regions demand permanently exceeds supply. Capacity
# does free up, unpredictably and often at odd hours -- so the practical answer
# is to keep asking until it does.
#
# This script asks once per interval and stops the moment one succeeds.
#
# Usage:
#   export OCI_COMPARTMENT_ID=ocid1.tenancy.oc1..aaaa...   # your tenancy OCID
#   bash scripts/oci-retry-launch.sh
#
# Optional overrides:
#   INSTANCE_NAME     default imboni-server
#   SSH_KEY_FILE      default ~/.ssh/imboni_oracle.pub
#   BOOT_VOLUME_GB    default 100
#   INTERVAL          default 90 (seconds between attempts)
#   MAX_ATTEMPTS      default 0 (0 = forever)
#
# Requires the OCI CLI, configured once with `oci setup config`.
# ============================================================================

INSTANCE_NAME="${INSTANCE_NAME:-imboni-server}"
SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/imboni_oracle.pub}"
BOOT_VOLUME_GB="${BOOT_VOLUME_GB:-100}"
INTERVAL="${INTERVAL:-90}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-0}"

# Shape configurations to try, largest first. A1.Flex can be resized later
# (console -> Edit shape, needs a reboot), so taking a smaller instance now and
# growing it when capacity frees beats waiting indefinitely for 4/24.
SHAPE_CONFIGS=(
    "4:24"
    "2:12"
    "1:6"
)

command -v oci >/dev/null 2>&1 || {
    echo "ERROR: the OCI CLI is not installed. See the setup notes in DEPLOY_ORACLE.md." >&2
    exit 1
}

: "${OCI_COMPARTMENT_ID:?set OCI_COMPARTMENT_ID to your tenancy or compartment OCID}"

[[ -f "$SSH_KEY_FILE" ]] || {
    echo "ERROR: no SSH public key at $SSH_KEY_FILE" >&2
    echo "Generate one with: ssh-keygen -t ed25519 -f \${HOME}/.ssh/imboni_oracle" >&2
    exit 1
}

echo "[oci] Discovering availability domain, image and subnet..."

AD=$(oci iam availability-domain list \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --query 'data[0].name' --raw-output) || exit 1

# Newest Ubuntu 24.04 build for this shape. Filtering by --shape is what keeps
# the result aarch64: the same OS name exists as an x86 image, and launching an
# x86 image on an Ampere shape fails.
IMAGE_ID=$(oci compute image list \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --operating-system "Canonical Ubuntu" \
        --operating-system-version "24.04" \
        --shape "VM.Standard.A1.Flex" \
        --sort-by TIMECREATED --sort-order DESC \
        --query 'data[0].id' --raw-output) || exit 1

# The instance must land in a PUBLIC subnet, otherwise no public IP can ever be
# attached to it.
SUBNET_ID=$(oci network subnet list \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --query "data[?\"prohibit-public-ip-on-vnic\"==\`false\`]|[0].id" \
        --raw-output) || exit 1

if [[ -z "$SUBNET_ID" || "$SUBNET_ID" == "null" ]]; then
    echo "ERROR: no public subnet found. Create a VCN with a public subnet first" >&2
    echo "       (Networking -> Virtual Cloud Networks -> Start VCN Wizard)." >&2
    exit 1
fi

echo "[oci] AD     : $AD"
echo "[oci] Image  : $IMAGE_ID"
echo "[oci] Subnet : $SUBNET_ID"
echo "[oci] Trying shapes: ${SHAPE_CONFIGS[*]} (ocpu:memory), every ${INTERVAL}s"
echo ""

attempt=0
while :; do
    attempt=$((attempt + 1))

    for config in "${SHAPE_CONFIGS[@]}"; do
        ocpus="${config%%:*}"
        memory="${config##*:}"

        printf '[%s] attempt %d — %s OCPU / %s GB ... ' \
            "$(date +%H:%M:%S)" "$attempt" "$ocpus" "$memory"

        output=$(oci compute instance launch \
            --compartment-id "$OCI_COMPARTMENT_ID" \
            --availability-domain "$AD" \
            --display-name "$INSTANCE_NAME" \
            --image-id "$IMAGE_ID" \
            --shape "VM.Standard.A1.Flex" \
            --shape-config "{\"ocpus\":${ocpus},\"memoryInGBs\":${memory}}" \
            --subnet-id "$SUBNET_ID" \
            --assign-public-ip true \
            --boot-volume-size-in-gbs "$BOOT_VOLUME_GB" \
            --ssh-authorized-keys-file "$SSH_KEY_FILE" \
            --wait-for-state RUNNING \
            2>&1)
        status=$?

        if [[ $status -eq 0 ]]; then
            echo "SUCCESS"
            echo ""
            echo "========================================"
            echo " Instance is RUNNING (${ocpus} OCPU / ${memory} GB)"
            echo "========================================"
            echo "$output" | grep -iE '"id"|"display-name"|"lifecycle-state"' | head -5
            echo ""
            echo "Public IP:"
            oci compute instance list-vnics \
                --instance-id "$(echo "$output" | grep -oE 'ocid1\.instance\.[a-z0-9.-]+' | head -1)" \
                --query 'data[0]."public-ip"' --raw-output 2>/dev/null || \
                echo "  (check the console)"
            echo ""
            echo "Connect with:  ssh -i ${SSH_KEY_FILE%.pub} ubuntu@<that IP>"
            exit 0
        fi

        if echo "$output" | grep -qi "out of capacity\|OutOfCapacity\|LimitExceeded"; then
            echo "out of capacity"
        else
            # A real error (bad OCID, quota, malformed key) will repeat forever,
            # so surface it and stop rather than looping on it silently.
            echo "FAILED"
            echo ""
            echo "$output" | head -20
            echo ""
            echo "[oci] This does not look like a capacity error. Stopping." >&2
            exit 1
        fi
    done

    if [[ "$MAX_ATTEMPTS" != "0" && "$attempt" -ge "$MAX_ATTEMPTS" ]]; then
        echo "[oci] Gave up after ${attempt} attempts."
        exit 1
    fi

    sleep "$INTERVAL"
done
