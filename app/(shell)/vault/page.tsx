import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { getVaultMasterConfig, listSecrets } from "@/lib/data/vault";
import { listProjects } from "@/lib/data/projects";
import { listClients } from "@/lib/data/clients";
import { unpackVaultSessionCookie, VAULT_SESSION_COOKIE } from "@/lib/crypto/vaultSession";
import { VaultScreen } from "@/components/vault/VaultScreen";

export const metadata = { title: "Vault" };

export default async function VaultPage() {
  const session = (await auth())!;
  const admin = isPartnerAdmin(session);
  const config = await getVaultMasterConfig();
  const cookieValue = (await cookies()).get(VAULT_SESSION_COOKIE)?.value;
  const unlocked = admin && !!config && !!cookieValue && !!unpackVaultSessionCookie(cookieValue);
  const [secrets, projects, clients] = await Promise.all([
    config ? listSecrets() : Promise.resolve([]),
    admin ? listProjects() : Promise.resolve([]),
    admin ? listClients() : Promise.resolve([]),
  ]);
  return (
    <VaultScreen
      state={!config ? "setup" : unlocked ? "unlocked" : "locked"}
      admin={admin}
      secrets={secrets}
      projects={projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
