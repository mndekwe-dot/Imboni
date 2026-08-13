#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Imboni — create the VCN an instance launch needs
# ============================================================================
# The console's "create a new VCN inline" option only creates the network when
# the instance itself launches. If the launch fails (which it does repeatedly
# while A1 capacity is exhausted), no VCN is left behind -- so the retry script
# has nothing to launch into.
#
# This builds the network up front, once:
#
#   VCN 10.0.0.0/16
#     internet gateway
#     default route table:  0.0.0.0/0 -> internet gateway
#     public subnet 10.0.0.0/24
#     security list ingress: 22 (SSH), 80 (ACME + redirect), 443 (TLS)
#
# Usage:
#   export OCI_COMPARTMENT_ID=ocid1.tenancy.oc1..aaaa...
#   bash scripts/oci-create-network.sh
#
# Idempotent: if a VCN with the same display name already exists it is reused
# rather than duplicated.
# ============================================================================

export SUPPRESS_LABEL_WARNING=True

OCI_BIN="${OCI_BIN:-oci}"
VCN_NAME="${VCN_NAME:-imboni-vcn}"
SUBNET_NAME="${SUBNET_NAME:-imboni-public-subnet}"
VCN_CIDR="${VCN_CIDR:-10.0.0.0/16}"
SUBNET_CIDR="${SUBNET_CIDR:-10.0.0.0/24}"

: "${OCI_COMPARTMENT_ID:?set OCI_COMPARTMENT_ID to your tenancy or compartment OCID}"

echo "[net] Looking for an existing ${VCN_NAME}..."
VCN_ID=$($OCI_BIN network vcn list \
    --compartment-id "$OCI_COMPARTMENT_ID" \
    --display-name "$VCN_NAME" \
    --query 'data[0].id' --raw-output 2>/dev/null || true)

if [[ -z "$VCN_ID" || "$VCN_ID" == "null" ]]; then
    echo "[net] Creating VCN ${VCN_NAME} (${VCN_CIDR})..."
    VCN_ID=$($OCI_BIN network vcn create \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --cidr-block "$VCN_CIDR" \
        --display-name "$VCN_NAME" \
        --dns-label imbonivcn \
        --wait-for-state AVAILABLE \
        --query 'data.id' --raw-output)
else
    echo "[net] Reusing existing VCN."
fi
echo "[net] VCN: $VCN_ID"

# ---------------------------------------------------------------------------
# Internet gateway — without it the subnet has no route off the VCN and the
# instance is unreachable even with a public IP attached.
# ---------------------------------------------------------------------------
IGW_ID=$($OCI_BIN network internet-gateway list \
    --compartment-id "$OCI_COMPARTMENT_ID" --vcn-id "$VCN_ID" \
    --query 'data[0].id' --raw-output 2>/dev/null || true)

if [[ -z "$IGW_ID" || "$IGW_ID" == "null" ]]; then
    echo "[net] Creating internet gateway..."
    IGW_ID=$($OCI_BIN network internet-gateway create \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --vcn-id "$VCN_ID" \
        --is-enabled true \
        --display-name imboni-igw \
        --wait-for-state AVAILABLE \
        --query 'data.id' --raw-output)
fi
echo "[net] Internet gateway: $IGW_ID"

# ---------------------------------------------------------------------------
# Default route table -> send everything not local to the internet gateway.
# ---------------------------------------------------------------------------
RT_ID=$($OCI_BIN network vcn get --vcn-id "$VCN_ID" \
    --query 'data."default-route-table-id"' --raw-output)

echo "[net] Adding default route 0.0.0.0/0 -> internet gateway..."
$OCI_BIN network route-table update \
    --rt-id "$RT_ID" \
    --route-rules "[{\"cidrBlock\":\"0.0.0.0/0\",\"networkEntityId\":\"${IGW_ID}\"}]" \
    --force >/dev/null

# ---------------------------------------------------------------------------
# Security list — Oracle's default allows SSH only. Add 80 and 443.
#
# NOTE: this is only ONE of the two firewalls. Oracle's Ubuntu images also drop
# 80/443 in iptables on the instance itself; see DEPLOY_ORACLE.md.
# ---------------------------------------------------------------------------
SL_ID=$($OCI_BIN network vcn get --vcn-id "$VCN_ID" \
    --query 'data."default-security-list-id"' --raw-output)

echo "[net] Opening ingress 22, 80, 443..."
$OCI_BIN network security-list update \
    --security-list-id "$SL_ID" \
    --ingress-security-rules '[
      {"protocol":"6","source":"0.0.0.0/0","isStateless":false,
       "tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},
      {"protocol":"6","source":"0.0.0.0/0","isStateless":false,
       "tcpOptions":{"destinationPortRange":{"min":80,"max":80}}},
      {"protocol":"6","source":"0.0.0.0/0","isStateless":false,
       "tcpOptions":{"destinationPortRange":{"min":443,"max":443}}},
      {"protocol":"1","source":"0.0.0.0/0","isStateless":false,
       "icmpOptions":{"type":3,"code":4}}
    ]' \
    --egress-security-rules '[
      {"protocol":"all","destination":"0.0.0.0/0","isStateless":false}
    ]' \
    --force >/dev/null

# ---------------------------------------------------------------------------
# Public subnet. prohibit-public-ip-on-vnic=false is what makes it "public" and
# is the thing the launch script looks for.
# ---------------------------------------------------------------------------
SUBNET_ID=$($OCI_BIN network subnet list \
    --compartment-id "$OCI_COMPARTMENT_ID" --vcn-id "$VCN_ID" \
    --display-name "$SUBNET_NAME" \
    --query 'data[0].id' --raw-output 2>/dev/null || true)

if [[ -z "$SUBNET_ID" || "$SUBNET_ID" == "null" ]]; then
    echo "[net] Creating public subnet ${SUBNET_NAME} (${SUBNET_CIDR})..."
    SUBNET_ID=$($OCI_BIN network subnet create \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --vcn-id "$VCN_ID" \
        --cidr-block "$SUBNET_CIDR" \
        --display-name "$SUBNET_NAME" \
        --dns-label public \
        --prohibit-public-ip-on-vnic false \
        --route-table-id "$RT_ID" \
        --security-list-ids "[\"${SL_ID}\"]" \
        --wait-for-state AVAILABLE \
        --query 'data.id' --raw-output)
else
    echo "[net] Reusing existing subnet."
fi

echo ""
echo "========================================"
echo " Network ready"
echo "========================================"
echo "  VCN    : $VCN_ID"
echo "  Subnet : $SUBNET_ID (public)"
echo ""
echo "Next:  bash scripts/oci-retry-launch.sh"
