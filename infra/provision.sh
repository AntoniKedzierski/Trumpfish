#!/usr/bin/env bash
#
# Creates everything Trumpfish runs on in Azure. Safe to read before it is safe to run: every resource it creates is listed
# in the summary it prints at the end, and all of them live in one resource group that can be deleted in a single command.
#
#   az login
#   bash infra/provision.sh
#
# Run from the repository root. It is not idempotent - it expects an empty resource group.

set -euo pipefail

RG=rg-trumpfish-prod
LOCATION=polandcentral
DNS_LABEL=trumpfish
VM_NAME=vm-trumpfish
#VM_SIZE=Standard_B2als_v2      # docelowy rozmiar, zablokowany kwota
# Temporary. The intended size is Standard_B2als_v2 (2 vCPU / 4 GiB, 27 EUR/month), but every burstable family sits at a
# quota of 0 while the billing account is under review, and the quota request itself is refused until then. This is the
# cheapest size whose family has quota today; it costs 61 EUR/month for the same 2 vCPU and 4 GiB.
# Once the review clears and standardBasv2Family is raised, swap the size back and run:
#     az vm deallocate -g rg-trumpfish-prod -n vm-trumpfish
#     az vm resize -g rg-trumpfish-prod -n vm-trumpfish --size Standard_B2als_v2
#     az vm start -g rg-trumpfish-prod -n vm-trumpfish
# The disk, the address, the DNS name and the data all survive that; it costs about a minute of downtime.
VM_SIZE=Standard_D2als_v6
OS_DISK_GB=32
ADMIN_USER=azureuser

# Whoever runs this gets SSH access from wherever they are sitting now. A changed address is one command to fix, and
# `az vm run-command invoke` reaches the machine without SSH regardless, so there is no way to lock yourself out for good.
ADMIN_IP=$(curl -fsS https://api.ipify.org)

# Storage account names are global and allow no punctuation, hence the suffix.
STORAGE_ACCOUNT="sttrumpfish$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SUBSCRIPTION=$(az account show --query id -o tsv)
TMPDIR_RA=$(mktemp -d)
trap 'rm -rf "$TMPDIR_RA"' EXIT

echo "Subskrypcja : $(az account show --query name -o tsv)"
echo "Region      : $LOCATION"
echo "Adres SSH   : $ADMIN_IP"
echo "Storage     : $STORAGE_ACCOUNT"
echo

echo "==> Grupa zasobów"
az group create -n "$RG" -l "$LOCATION" -o none

echo "==> Sieć wirtualna i podsieć"
az network vnet create -g "$RG" -n vnet-trumpfish \
    --address-prefix 10.20.0.0/16 \
    --subnet-name snet-app --subnet-prefix 10.20.1.0/24 -o none

echo "==> Sieciowa grupa zabezpieczeń"
az network nsg create -g "$RG" -n nsg-trumpfish -o none

# 80 has to stay open even though every request on it is redirected: it is where the certificate authority answers the
# ACME challenge, and a closed port 80 means a certificate that cannot be renewed.
az network nsg rule create -g "$RG" --nsg-name nsg-trumpfish -n allow-http \
    --priority 100 --protocol Tcp --access Allow --direction Inbound \
    --source-address-prefixes Internet --destination-port-ranges 80 -o none

az network nsg rule create -g "$RG" --nsg-name nsg-trumpfish -n allow-https \
    --priority 110 --protocol Tcp --access Allow --direction Inbound \
    --source-address-prefixes Internet --destination-port-ranges 443 -o none

az network nsg rule create -g "$RG" --nsg-name nsg-trumpfish -n allow-ssh-admin \
    --priority 120 --protocol Tcp --access Allow --direction Inbound \
    --source-address-prefixes "$ADMIN_IP/32" --destination-port-ranges 22 -o none

# Everything else is refused by the default rule at priority 65500. Postgres is never published to the host at all, so
# there is nothing to close on 5432.

echo "==> Publiczny adres IP i nazwa DNS"
# Static, because a released address takes the certificate with it. Standard is the only SKU left; Basic was retired.
az network public-ip create -g "$RG" -n pip-trumpfish \
    --sku Standard --allocation-method Static --version IPv4 \
    --dns-name "$DNS_LABEL" -o none

echo "==> Maszyna wirtualna"
az vm create -g "$RG" -n "$VM_NAME" \
    --image Ubuntu2404 \
    --size "$VM_SIZE" \
    --admin-username "$ADMIN_USER" \
    --authentication-type ssh --generate-ssh-keys \
    --vnet-name vnet-trumpfish --subnet snet-app \
    --nsg nsg-trumpfish \
    --public-ip-address pip-trumpfish \
    --storage-sku StandardSSD_LRS --os-disk-size-gb "$OS_DISK_GB" \
    --assign-identity \
    --custom-data "$SCRIPT_DIR/cloud-init.yaml" \
    -o none

echo "==> Konto magazynu na kopie zapasowe"
az storage account create -g "$RG" -n "$STORAGE_ACCOUNT" -l "$LOCATION" \
    --sku Standard_LRS --access-tier Cool --kind StorageV2 \
    --min-tls-version TLS1_2 --allow-blob-public-access false -o none

az storage container create --account-name "$STORAGE_ACCOUNT" -n pg-backups --auth-mode login -o none

echo "==> Reguła cyklu życia kopii (usuwanie po 90 dniach)"
az storage account management-policy create --account-name "$STORAGE_ACCOUNT" -g "$RG" \
    --policy "$SCRIPT_DIR/backup-lifecycle.json" -o none

echo "==> Uprawnienie maszyny do zapisu kopii"
# The machine writes backups as itself. Nothing on the disk is a credential, so nothing on the disk can leak one.
PRINCIPAL=$(az vm show -g "$RG" -n "$VM_NAME" --query identity.principalId -o tsv)
SCOPE=$(az storage account show -g "$RG" -n "$STORAGE_ACCOUNT" --query id -o tsv)

# Assigned through the management API rather than `az role assignment create`, which resolves the assignee through Microsoft
# Graph first and fails on some tenants with a misleading "MissingSubscription". Going straight at the resource provider
# skips that lookup - the principal id is already known, so there is nothing to look up.
ROLE_STORAGE_BLOB_DATA_CONTRIBUTOR=ba92f5b4-2d11-453d-a403-e96b0029c9fe
ASSIGNMENT_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)

cat > "$TMPDIR_RA/role-assignment.json" <<JSON
{
  "properties": {
    "roleDefinitionId": "/subscriptions/$SUBSCRIPTION/providers/Microsoft.Authorization/roleDefinitions/$ROLE_STORAGE_BLOB_DATA_CONTRIBUTOR",
    "principalId": "$PRINCIPAL",
    "principalType": "ServicePrincipal"
  }
}
JSON

# The identity takes a moment to become visible, so this is worth retrying rather than failing on.
for attempt in 1 2 3 4 5 6; do
    if az rest --method put -o none \
        --url "https://management.azure.com$SCOPE/providers/Microsoft.Authorization/roleAssignments/$ASSIGNMENT_ID?api-version=2022-04-01" \
        --body "@$TMPDIR_RA/role-assignment.json" 2>/dev/null; then
        break
    fi
    echo "    tożsamość jeszcze nie rozpropagowana, próba $attempt/6..."
    sleep 10
done

FQDN=$(az network public-ip show -g "$RG" -n pip-trumpfish --query dnsSettings.fqdn -o tsv)
IP=$(az network public-ip show -g "$RG" -n pip-trumpfish --query ipAddress -o tsv)

cat <<SUMMARY

Gotowe.

  Adres        : https://$FQDN
  IP           : $IP
  SSH          : ssh $ADMIN_USER@$FQDN
  Storage      : $STORAGE_ACCOUNT (kontener pg-backups)
  Grupa zasobów: $RG

Wszystko usuwa jedno polecenie:  az group delete -n $RG --yes

Maszyna kończy jeszcze konfigurację wstępną (Docker, swap, Azure CLI) - to kilka minut po pierwszym zalogowaniu.
Postęp:  ssh $ADMIN_USER@$FQDN 'cloud-init status --wait'
SUMMARY
