import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { getVaultMasterConfig, listSecrets } from "@/lib/data/vault";
import {
  unpackVaultSessionCookie,
  VAULT_SESSION_COOKIE,
} from "@/lib/crypto/vaultSession";
import { SetupVaultForm } from "@/components/vault/SetupVaultForm";
import { UnlockModal } from "@/components/vault/UnlockModal";
import { AddSecretModal } from "@/components/vault/AddSecretModal";
import { SecretRow } from "@/components/vault/SecretRow";
import { LockButton } from "@/components/vault/LockButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default async function VaultPage() {
  const session = await auth();
  const admin = isPartnerAdmin(session);
  const config = await getVaultMasterConfig();

  if (!config) {
    if (!admin) {
      return (
        <div className="mx-auto max-w-md">
          <Card className="text-center text-sm text-muted-foreground">
            The vault has not been set up yet. Ask a Partner/Admin to initialize
            it.
          </Card>
        </div>
      );
    }
    return <SetupVaultForm />;
  }

  const secrets = await listSecrets();
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(VAULT_SESSION_COOKIE)?.value;
  const unlocked =
    admin && !!cookieValue && !!unpackVaultSessionCookie(cookieValue);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Secrets Vault</h1>
        {admin && unlocked && (
          <div className="flex items-center gap-2">
            <LockButton />
            <AddSecretModal />
          </div>
        )}
      </div>

      {admin && !unlocked && <UnlockModal />}
      {!admin && (
        <p className="mb-4 text-xs text-muted-foreground">
          Secrets are shown masked only. Ask a Partner/Admin to reveal a value
          if you need it.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {secrets.length === 0 && (
          <Card>
            <EmptyState
              icon={KeyRound}
              title="No credentials stored"
              description="Everything added here is encrypted with AES-256 and every reveal is logged."
            />
          </Card>
        )}
        {secrets.map((s) => (
          <SecretRow
            key={s.id}
            id={s.id}
            label={s.label}
            secretType={s.secretType}
            maskedPreview={s.maskedPreview}
            canReveal={admin}
          />
        ))}
      </div>
    </div>
  );
}
