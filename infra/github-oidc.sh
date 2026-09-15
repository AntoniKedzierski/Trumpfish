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

echo "==> Uprawnienie do maszyny"
SCOPE=$(az vm show -g "$RG" -n "$VM_NAME" --query id -o tsv)
ROLE="Virtual Machine Contributor"

# Scoped to the single machine rather than the resource group: this identity can restart and run commands on the host it
# deploys to, and cannot touch the storage account holding the backups or the network rules protecting it.
if [ -n "$(az role assignment list --assignee "$SP_ID" --scope "$SCOPE" --query "[?roleDefinitionName=='$ROLE'].id" -o tsv)" ]; then
    echo "    już przypisane"
else
    # --assignee-object-id with the type stated skips the Microsoft Graph lookup that `--assignee` does first and that
    # fails on some tenants with a misleading "MissingSubscription". The object id is already known, so there is nothing
    # left to look up.
    az role assignment create \
        --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
        --role "$ROLE" --scope "$SCOPE" -o none
    echo "    przypisano"
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
