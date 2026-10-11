"use client";

import { useEffect, useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import { FieldRow, ListSection, PlainRowInput, RowInput } from "@/components/ui/List";
import { Select, Textarea } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/Confirm";
import { DeleteRow, MoneyRow, type Option } from "@/components/forms/Fields";
import { useCanSeeMoney } from "@/components/shell/QuickAdd";
import { useMutation } from "@/lib/useMutation";
import { CAMPAIGN_CHANNEL, CAMPAIGN_STATUS, POST_CHANNEL, POST_STATUS } from "@/lib/labels";
import { minorToMajor } from "@/lib/money";
import { todayYmd } from "@/lib/time";
import type { CampaignChannel, Currency } from "@/lib/data/types";
import type { CampaignStatus, MarketingCampaign, MarketingPost, PostChannel, PostStatus } from "@/lib/data/marketing";

/** "2026-10-14T10:00" in this device's time zone, for a datetime-local input. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export type PostDefaults = { publishAt?: string; campaignId?: string; status?: PostStatus };

/** A post on the content calendar: what, where, when, who, and its caption. */
export function PostSheet({
  post,
  defaults,
  open,
  onOpenChange,
  campaigns,
  users,
  assets,
}: {
  post?: MarketingPost;
  defaults?: PostDefaults;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaigns: Option[];
  users: Option[];
  /** Brand and marketing files to attach. */
  assets: Option[];
}) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const blank = { title: "", channel: "instagram" as PostChannel, status: "idea" as PostStatus, publishAt: "", ownerId: "", campaignId: "", caption: "", link: "", notes: "", assetFileId: "" };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      post
        ? {
            title: post.title,
            channel: post.channel,
            status: post.status,
            publishAt: toLocalInput(post.publishAt),
            ownerId: post.ownerId ?? "",
            campaignId: post.campaignId ?? "",
            caption: post.caption ?? "",
            link: post.link ?? "",
            notes: post.notes ?? "",
            assetFileId: post.assetFileId ?? "",
          }
        : { ...blank, publishAt: defaults?.publishAt ?? "", campaignId: defaults?.campaignId ?? "", status: defaults?.status ?? (defaults?.publishAt ? "drafting" : "idea") },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post]);

  const submit = async () => {
    const payload = { ...f, publishAt: f.publishAt ? new Date(f.publishAt).toISOString() : "" };
    return !!(post
      ? await run(`/api/marketing/posts/${post.id}`, { method: "PATCH", body: payload, success: "Saved" })
      : await run("/api/marketing/posts", { body: payload, success: "Post added" }));
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={post ? "Post" : "New Post"} submitLabel={post ? "Done" : "Add"} canSubmit={!!f.title.trim()} onSubmit={submit}>
      <ListSection>
        <PlainRowInput placeholder="What's the post? (e.g. Ox Roastery case study)" value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus={!post} />
      </ListSection>
      <ListSection>
        <FieldRow label="Channel">
          <Select value={f.channel} onChange={(e) => set("channel", e.target.value as PostChannel)}>
            {(Object.keys(POST_CHANNEL) as PostChannel[]).map((c) => (
              <option key={c} value={c}>
                {POST_CHANNEL[c].label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Status">
          <Select value={f.status} onChange={(e) => set("status", e.target.value as PostStatus)}>
            {(Object.keys(POST_STATUS) as PostStatus[]).map((s) => (
              <option key={s} value={s}>
                {POST_STATUS[s].label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Goes out">
          <RowInput type="datetime-local" value={f.publishAt} onChange={(e) => set("publishAt", e.target.value)} />
        </FieldRow>
        <FieldRow label="Owner">
          <Select value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
            <option value="">{post ? "Nobody" : "Me"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </FieldRow>
        {campaigns.length > 0 && (
          <FieldRow label="Campaign">
            <Select value={f.campaignId} onChange={(e) => set("campaignId", e.target.value)}>
              <option value="">None</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
      </ListSection>
      <ListSection header="Caption">
        <div className="px-4 py-2.5">
          <Textarea dir="auto" placeholder="The words that go with it" rows={5} value={f.caption} onChange={(e) => set("caption", e.target.value)} />
        </div>
      </ListSection>
      <ListSection footer="The link to the live post once it's published, or to the draft (Canva, Google Docs…).">
        <PlainRowInput type="url" inputMode="url" placeholder="Link" value={f.link} onChange={(e) => set("link", e.target.value)} />
        {assets.length > 0 && (
          <FieldRow label="Asset">
            <Select value={f.assetFileId} onChange={(e) => set("assetFileId", e.target.value)}>
              <option value="">None</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
      </ListSection>
      <ListSection>
        <div className="px-4 py-2.5">
          <Textarea placeholder="Notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {post && (
        <DeleteRow
          label="Delete Post"
          onClick={async () => {
            if (await confirm({ title: `Delete “${post.title}”?`, destructive: true, confirmLabel: "Delete" })) {
              if (await run(`/api/marketing/posts/${post.id}`, { method: "DELETE", success: "Deleted" })) onOpenChange(false);
            }
          }}
        />
      )}
    </FormSheet>
  );
}

/** A campaign's plan: channel, dates, goal, budget and owner. */
export function CampaignSheet({ campaign, open, onOpenChange, users }: { campaign?: MarketingCampaign; open: boolean; onOpenChange: (o: boolean) => void; users: Option[] }) {
  const { run } = useMutation();
  const confirm = useConfirm();
  const blank = { name: "", channel: "instagram" as CampaignChannel, status: "active" as CampaignStatus, goal: "", startDate: todayYmd(), endDate: "", budget: "", currency: "BHD" as Currency, ownerId: "", notes: "" };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(
      campaign
        ? {
            name: campaign.name,
            channel: campaign.channel,
            status: campaign.status,
            goal: campaign.goal ?? "",
            startDate: campaign.startDate ?? "",
            endDate: campaign.endDate ?? "",
            budget: campaign.budgetCents === null ? "" : String(minorToMajor(campaign.budgetCents, campaign.currency)),
            currency: campaign.currency,
            ownerId: campaign.ownerId ?? "",
            notes: campaign.notes ?? "",
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign]);

  const submit = async () =>
    !!(campaign
      ? await run(`/api/marketing/campaigns/${campaign.id}`, { method: "PATCH", body: f, success: "Saved" })
      : await run("/api/marketing/campaigns", { body: f, success: "Campaign added" }));

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={campaign ? "Campaign" : "New Campaign"} submitLabel={campaign ? "Done" : "Add"} canSubmit={!!f.name.trim()} onSubmit={submit}>
      <ListSection>
        <PlainRowInput placeholder="Name (e.g. Ramadan offer 2027)" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!campaign} />
      </ListSection>
      <ListSection>
        <FieldRow label="Channel">
          <Select value={f.channel} onChange={(e) => set("channel", e.target.value as CampaignChannel)}>
            {(Object.keys(CAMPAIGN_CHANNEL) as CampaignChannel[]).map((c) => (
              <option key={c} value={c}>
                {CAMPAIGN_CHANNEL[c]}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Status">
          <Select value={f.status} onChange={(e) => set("status", e.target.value as CampaignStatus)}>
            {(Object.keys(CAMPAIGN_STATUS) as CampaignStatus[]).map((s) => (
              <option key={s} value={s}>
                {CAMPAIGN_STATUS[s].label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Starts">
          <RowInput type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </FieldRow>
        <FieldRow label="Ends">
          <RowInput type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </FieldRow>
        <MoneyRow label="Budget" amount={f.budget} currency={f.currency} onAmount={(v) => set("budget", v)} onCurrency={(v) => set("currency", v)} />
        <FieldRow label="Owner">
          <Select value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
            <option value="">{campaign ? "Nobody" : "Me"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </FieldRow>
      </ListSection>
      <ListSection header="Goal" footer="What success looks like, e.g. “40 leads from restaurants in Manama”.">
        <div className="px-4 py-2.5">
          <Textarea dir="auto" rows={2} placeholder="Goal" value={f.goal} onChange={(e) => set("goal", e.target.value)} />
        </div>
      </ListSection>
      <ListSection>
        <div className="px-4 py-2.5">
          <Textarea placeholder="Notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </ListSection>
      {campaign && (
        <DeleteRow
          label="Delete Campaign"
          onClick={async () => {
            if (await confirm({ title: `Delete “${campaign.name}”?`, message: "Its posts and deals stay, no longer linked to it. Its logged numbers are deleted.", destructive: true, confirmLabel: "Delete" })) {
              if (await run(`/api/marketing/campaigns/${campaign.id}`, { method: "DELETE", success: "Deleted" })) onOpenChange(false);
            }
          }}
        />
      )}
    </FormSheet>
  );
}

/** A day's numbers for a campaign: spend, leads, conversions, and for partners revenue. */
export function CampaignNumbersSheet({ campaign, open, onOpenChange }: { campaign: MarketingCampaign | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run } = useMutation();
  const money = useCanSeeMoney();
  const [f, setF] = useState({ metricDate: todayYmd(), spend: "", leadsCaptured: "", conversions: "", revenue: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    if (open) setF({ metricDate: todayYmd(), spend: "", leadsCaptured: "", conversions: "", revenue: "" });
  }, [open]);
  if (!campaign) return null;
  const cur = campaign.currency;
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Log Numbers"
      submitLabel="Save"
      size="auto"
      onSubmit={async () => {
        const { revenue, ...rest } = f;
        return !!(await run(`/api/marketing/campaigns/${campaign.id}/numbers`, { body: money && revenue ? { ...rest, revenue } : rest, success: "Logged" }));
      }}
    >
      <ListSection header={campaign.name} footer="Logging the same day again replaces that day's numbers.">
        <FieldRow label="Day">
          <RowInput type="date" value={f.metricDate} onChange={(e) => set("metricDate", e.target.value)} />
        </FieldRow>
        <FieldRow label={`Spend (${cur})`}>
          <RowInput inputMode="decimal" placeholder="0" value={f.spend} onChange={(e) => set("spend", e.target.value.replace(/[^0-9.]/g, ""))} className="w-28 tabular" />
        </FieldRow>
        <FieldRow label="Leads">
          <RowInput inputMode="numeric" placeholder="0" value={f.leadsCaptured} onChange={(e) => set("leadsCaptured", e.target.value.replace(/\D/g, ""))} className="w-28 tabular" />
        </FieldRow>
        <FieldRow label="Conversions">
          <RowInput inputMode="numeric" placeholder="0" value={f.conversions} onChange={(e) => set("conversions", e.target.value.replace(/\D/g, ""))} className="w-28 tabular" />
        </FieldRow>
        {money && (
          <FieldRow label={`Revenue (${cur})`}>
            <RowInput inputMode="decimal" placeholder="0" value={f.revenue} onChange={(e) => set("revenue", e.target.value.replace(/[^0-9.]/g, ""))} className="w-28 tabular" />
          </FieldRow>
        )}
      </ListSection>
    </FormSheet>
  );
}
