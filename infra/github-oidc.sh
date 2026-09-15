#!/usr/bin/env bash
#
# One time setup of the identity the pipeline deploys with. Run once, from the repository root, after provision.sh has
# created the machine:
#
#   az login
#   bash infra/github-oidc.sh
#
# It registers an application in Entra ID, lets GitHub Actions sign in as it over OIDC, and gives it the right to run
# commands on that one virtual machine and nothing else. Nothing secret comes out of it: the three values it prints are
# identifiers, and the trust is anchored on the repository and branch named below rather than on a password. That is the
# whole point of doing it this way - there is no credential to rotate and none to leak.
#
# Safe to run again. Everything it creates is looked up first and only created when it is missing.

set -euo pipefail

RG=rg-trumpfish-prod
VM_NAME=vm-trumpfish
APP_NAME=github-trumpfish-deploy
REPO=AntoniKedzierski/Trumpfish
BRANCH=master
# Matches `environment: production` in .github/workflows/deploy.yml. The token GitHub issues for a job that names an
# environment says so, and a credential that does not mention the environment will not match it.
ENVIRONMENT=production

SUBSCRIPTION=$(az account show --query id -o tsv)
TENANT=$(az account show --query tenantId -o tsv)

echo "Subskrypcja : $(az account show --query name -o tsv)"
echo "Repozytorium: $REPO"
echo

echo "==> Rejestracja aplikacji"
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [ -z "$APP_ID" ]; then
    APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
    echo "    utworzono $APP_ID"
else
    echo "    już istnieje: $APP_ID"
fi

echo "==> Jednostka usługi"
SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)
if [ -z "$SP_ID" ]; then
    SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
    echo "    utworzono $SP_ID"
else
    echo "    już istnieje: $SP_ID"
fi

echo "==> Poświadczenia federacyjne"
# The subject is what Azure compares the token GitHub presents against, so it is also the boundary of the trust: a
# workflow in another repository, on another branch, or in a fork, produces a different subject and is refused.
add_credential() {
    local name=$1 subject=$2

    if [ -n "$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$name'].id" -o tsv)" ]; then
        echo "    $name już istnieje"
        return
    fi

    az ad app federated-credential create --id "$APP_ID" --parameters "{
        \"name\": \"$name\",
        \"issuer\": \"https://token.actions.githubusercontent.com\",
        \"subject\": \"$subject\",
        \"audiences\": [\"api://AzureADTokenExchange\"]
    }" -o none

    echo "    utworzono $name"
}

# The deployment job names an environment, so this is the credential it actually uses.
add_credential "github-environment-$ENVIRONMENT" "repo:$REPO:environment:$ENVIRONMENT"
# A fallback for the day the environment is dropped from the workflow, which would otherwise break deployments in a way
# that is tedious to diagnose from the pipeline's side.
add_credential "github-branch-$BRANCH" "repo:$REPO:ref:refs/heads/$BRANCH"

# The name of a role assignment is a GUID of the caller's choosing, not something Azure hands out. Neither of the two
# usual ways of producing one exists in Git Bash on Windows, where this is as likely to be run as on a Linux shell, so
# there is a fallback that shapes sixteen random bytes into a version 4 GUID by hand.
new_uuid() {
    local hex

    if [ -r /proc/sys/kernel/random/uuid ]; then
        cat /proc/sys/kernel/random/uuid
    elif command -v uuidgen > /dev/null 2>&1; then
        uuidgen
    else
        hex=$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n')
        printf '%s-%s-4%s-a%s-%s\n' "${hex:0:8}" "${hex:8:4}" "${hex:13:3}" "${hex:17:3}" "${hex:20:12}"
    fi
}

echo "==> Uprawnienie do maszyny"
SCOPE=$(az vm show -g "$RG" -n "$VM_NAME" --query id -o tsv)

# Scoped to the single machine rather than the resource group: this identity can restart and run commands on the host it
# deploys to, and cannot touch the storage account holding the backups or the network rules protecting it.
ROLE_VIRTUAL_MACHINE_CONTRIBUTOR=9980e02c-c2be-4d73-94e8-173b1dc7cf3c
ROLE_ID="/subscriptions/$SUBSCRIPTION/providers/Microsoft.Authorization/roleDefinitions/$ROLE_VIRTUAL_MACHINE_CONTRIBUTOR"

# Both calls go straight at the resource provider rather than through `az role assignment`, which fails here with a
# misleading "MissingSubscription" - the whole command group does, listing included, so it is not the assignee lookup it
# is usually blamed on. provision.sh works around the same thing the same way.
ASSIGNMENTS_URL="https://management.azure.com$SCOPE/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01"

EXISTING=$(az rest --method get --url "$ASSIGNMENTS_URL" \
    --query "value[?properties.principalId=='$SP_ID' && properties.roleDefinitionId=='$ROLE_ID'].id" -o tsv)

if [ -n "$EXISTING" ]; then
    echo "    już przypisane"
else
    TMPDIR_RA=$(mktemp -d)
    trap 'rm -rf "$TMPDIR_RA"' EXIT

    ASSIGNMENT_ID=$(new_uuid)

    cat > "$TMPDIR_RA/role-assignment.json" <<JSON
{
  "properties": {
    "roleDefinitionId": "$ROLE_ID",
    "principalId": "$SP_ID",
    "principalType": "ServicePrincipal"
  }
}
JSON

    # A service principal created moments ago takes a little while to become visible to the Authorization provider, so a
    # refusal on the first attempt means nothing.
    for attempt in 1 2 3 4 5 6; do
        if az rest --method put -o none \
            --url "https://management.azure.com$SCOPE/providers/Microsoft.Authorization/roleAssignments/$ASSIGNMENT_ID?api-version=2022-04-01" \
            --body "@$TMPDIR_RA/role-assignment.json" 2>/dev/null; then
            echo "    przypisano"
            break
        fi

        if [ "$attempt" = 6 ]; then
            echo "Nie udało się przypisać roli do $SCOPE." >&2
            exit 1
        fi

        echo "    jednostka usługi jeszcze nie rozpropagowana, próba $attempt/6..."
        sleep 10
    done
fi

cat <<SUMMARY

Gotowe. Zostają trzy sekrety w repozytorium (Settings > Secrets and variables > Actions).
Z zainstalowanym gh wystarczy wkleić:

  gh secret set AZURE_CLIENT_ID --repo $REPO --body "$APP_ID"
  gh secret set AZURE_TENANT_ID --repo $REPO --body "$TENANT"
  gh secret set AZURE_SUBSCRIPTION_ID --repo $REPO --body "$SUBSCRIPTION"

Żadna z tych wartości nie jest hasłem - są sekretami tylko dlatego, że nie ma powodu ich ogłaszać.

Odwołanie dostępu w całości:  az ad app delete --id $APP_ID
SUMMARY
