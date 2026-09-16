"use client";

import { EntityRowActions } from "@/components/entity/EntityRowActions";

/**
 * Only the label is editable. A credential's value is write-once by design —
 * replacing it means storing a new secret, so the old ciphertext is never
 * silently overwritten in place.
 */
export function SecretRowActions({ id, label }: { id: string; label: string }) {
  return (
    <EntityRowActions
      label="credential"
      name={label}
      endpoint={`/api/vault/${id}`}
      deleteDescription="The credential is destroyed, but the deletion is recorded in the vault access log. This cannot be undone."
      fields={[{ name: "label", label: "Label", value: label, required: true }]}
    />
  );
}
