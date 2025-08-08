// Supabase-backed CRM API helpers (SSR/RLS friendly)
// Falls back to mock when env is missing. Types from supabase.types.ts

import { createClient } from '@supabase/supabase-js'
import type { Database, Tables } from './supabase.types'

export type DealCard = { // Exported
  id: string
  title: string
  company?: string | null
  contact?: string | null
  amount?: number | null
  currency?: string | null
  stage_id: string
}

export type Stage = { // Exported
  id: string
  name: string
  order_index: number
  probability: number | null
}

export type Activity = Tables<'activities'> // Exported
export type Deal = Tables<'deals'> // Exported
export type Contact = Tables<'contacts'> // Exported

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let supabase: ReturnType<typeof createClient<Database>> | null = null;

function getClient() {
  if (supabase) return supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false
    }
  });
  return supabase;
}

// Mock fallback for dev without env configured
const mock = {
  stages: [
    { id: 's1', name: 'New', order_index: 10, probability: 10 },
    { id: 's2', name: 'Contacted', order_index: 20, probability: 25 },
    { id: 's3', name: 'Qualified', order_index: 30, probability: 45 }
  ] as Stage[],
  dealsByStage: {
    s1: [{ id: 'd1', title: 'Acme - Pilot', stage_id: 's1', amount: 2500, currency: 'USD' }],
    s2: [],
    s3: []
  } as Record<string, DealCard[]>,
  activities: [
    { id: 'a1', type: 'system', related_type: 'deal', related_id: 'd1', content: 'Seed: deal created', meta_json: null, created_by: null, created_at: new Date().toISOString() }
  ] as Activity[],
  contact: {
    id: 'c1', email: 'john@acme.com', full_name: 'John Doe', title: 'VP Sales',
    linkedin_url: 'https://linkedin.com/in/johndoe', website: 'https://acme.com',
    phone: null, company_id: null, owner_id: null, lifecycle_stage: 'lead',
    reply_status: null, reply_summary: null, generated_body_step1: null, generated_body_step2: null, generated_body_step3: null,
    latest_email_sent_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  } as Contact
}

export async function getPipelineStages(pipelineId?: string): Promise<Stage[]> {
  const supabase = getClient()
  if (!supabase) return mock.stages

  let effectivePipelineId = pipelineId;
  if (!effectivePipelineId || effectivePipelineId === 'p_default') {
    const { data: defaultPipeline, error } = await supabase.from('pipelines').select('id').eq('is_default', true).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    if (!defaultPipeline) return [];
    effectivePipelineId = defaultPipeline.id;
  }

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id,name,order_index,probability')
    .eq('pipeline_id', effectivePipelineId)
    .order('order_index', { ascending: true })

  if (error) throw error
  return (data ?? []) as Stage[]
}

export async function getDealsByPipeline(pipelineId?: string): Promise<Record<string, DealCard[]>> {
  const supabase = getClient()
  if (!supabase) return mock.dealsByStage

  // resolve pipeline id
  let effectivePipelineId = pipelineId;
  if (!effectivePipelineId || effectivePipelineId === 'p_default') {
    const { data: defaultPipeline, error } = await supabase.from('pipelines').select('id').eq('is_default', true).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    if (!defaultPipeline) return {};
    effectivePipelineId = defaultPipeline.id;
  }

  // fetch deals + join names
  const { data: deals, error } = await supabase
    .from('deals')
    .select('id,title,amount,currency,stage_id,company_id,contact_id')
    .eq('pipeline_id', effectivePipelineId)
  if (error) throw error

  // fetch related names in one go
  const companyIds = Array.from(new Set((deals ?? []).map((d: any) => d.company_id).filter(Boolean))) as string[]
  const contactIds = Array.from(new Set((deals ?? []).map((d: any) => d.contact_id).filter(Boolean))) as string[]

  const [companiesRes, contactsRes] = await Promise.all([
    companyIds.length ? supabase.from('companies').select('id,name').in('id', companyIds) : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    contactIds.length ? supabase.from('contacts').select('id,full_name').in('id', contactIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null })
  ])

  if (companiesRes.error) throw companiesRes.error
  if (contactsRes.error) throw contactsRes.error

  const companyMap = new Map((companiesRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
  const contactMap = new Map((contactsRes.data ?? []).map((c: { id: string; full_name: string | null }) => [c.id, c.full_name]))

  const grouped: Record<string, DealCard[]> = {}
  for (const d of (deals ?? []) as Array<{
    id: string; title: string; amount: number | null; currency: string | null; stage_id: string; company_id: string | null; contact_id: string | null;
  }>) {
    const card: DealCard = {
      id: d.id,
      title: d.title,
      amount: d.amount ?? null,
      currency: d.currency ?? null,
      stage_id: d.stage_id,
      company: d.company_id ? (companyMap.get(d.company_id) ?? null) : null,
      contact: d.contact_id ? (contactMap.get(d.contact_id) ?? null) : null
    }
    if (!grouped[d.stage_id]) grouped[d.stage_id] = []
    grouped[d.stage_id].push(card)
  }
  return grouped
}

export async function getDealDetail(id: string): Promise<Deal | null> {
  const supabase = getClient()
  if (!supabase) {
    const anyDeal = (Object.values(mock.dealsByStage).flat()[0] as DealCard | undefined)
    if (!anyDeal) return null
    // minimal mock cast
    return {
      id: anyDeal.id,
      title: anyDeal.title,
      amount: anyDeal.amount ?? null,
      currency: anyDeal.currency ?? null,
      company_id: null,
      contact_id: null,
      pipeline_id: 'default',
      stage_id: anyDeal.stage_id,
      status: 'open',
      source: 'inbound',
      notes: 'Mock',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      close_date: null
    } as unknown as Deal
  }

  const { data, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Deal | null)
}

export async function getActivitiesFor(relatedType: 'deal'|'contact'|'company', relatedId: string): Promise<Activity[]> {
  const supabase = getClient()
  if (!supabase) return mock.activities

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('related_type', relatedType)
    .eq('related_id', relatedId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Activity[]
}

export async function getContact(id: string): Promise<Contact | null> {
  const supabase = getClient()
  if (!supabase) return mock.contact
  const { data, error } = await supabase.from('contacts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Contact | null)
}

// Added to resolve a build error where 'getContactForDeal' was reported as missing,
// even though it's not explicitly imported in the relevant files.
// It simply delegates to getContact, as that's the intended logic.
export async function getContactForDeal(contactId: string): Promise<Contact | null> {
  return getContact(contactId);
}

// Added to resolve a build error where 'getStageName' was reported as missing.
export async function getStageName(stageId: string): Promise<string | undefined> {
  const supabase = getClient();
  if (!supabase) return mock.stages.find(s => s.id === stageId)?.name;
  const { data, error } = await supabase.from('pipeline_stages').select('name').eq('id', stageId).maybeSingle();
  if (error) throw error;
  return data?.name;
}

// Actions (write) — protected by RLS; expect JWT in frontend context.
// For SSR/Edge secure writes, prefer server-only key or edge function proxy.
export async function updateDealStage(dealId: string, nextStageId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClient()
  if (!supabase) return { ok: true }

  const { error } = await supabase.from('deals').update({ stage_id: nextStageId }).eq('id', dealId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function updateContactStatus(contactId: string, status: 'interested' | 'not_interested'): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: true };

  const { error } = await supabase.from('contacts').update({ reply_status: status }).eq('id', contactId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getCalendarLink(contactId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  // This is a mock implementation. In a real app, you'd generate a unique link
  // or fetch it from a calendar service.
  return { ok: true, url: `https://cal.com/your-username/${contactId}` };
}

// Helper to detect env presence
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export async function getOpenDealsCount(pipelineId?: string): Promise<number> {
  const supabase = getClient();
  if (!supabase) return 42; // Mock data

  let effectivePipelineId = pipelineId;
  if (!effectivePipelineId || effectivePipelineId === 'p_default') {
    const { data: defaultPipeline, error } = await supabase.from('pipelines').select('id').eq('is_default', true).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    if (!defaultPipeline) return 0;
    effectivePipelineId = defaultPipeline.id;
  }

  let query = supabase.from('deals').select('id', { count: 'exact' }).eq('status', 'open');
  if (effectivePipelineId) {
    query = query.eq('pipeline_id', effectivePipelineId);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getLast7DaysReplyCount(): Promise<number> {
  const supabase = getClient();
  if (!supabase) return 15; // Mock data

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count, error } = await supabase
    .from('contacts')
    .select('id', { count: 'exact' })
    .not('reply_status', 'is', null)
    .gte('updated_at', sevenDaysAgo.toISOString()); // Assuming updated_at reflects reply status changes
  if (error) throw error;
  return count ?? 0;
}

export async function getPipelineConversion(pipelineId?: string): Promise<PipelineConversion[]> {
  const supabase = getClient();
  if (!supabase) {
    return [ // Mock data
      { stage_id: 's1', stage_name: 'New', count: 10, conversion_to_next: 50 },
      { stage_id: 's2', stage_name: 'Contacted', count: 5, conversion_to_next: 80 },
      { stage_id: 's3', stage_name: 'Qualified', count: 4, conversion_to_next: undefined },
    ];
  }

  // This is a simplified mock for conversion. A real implementation would involve
  // more complex SQL queries or a materialized view to calculate conversions between stages.
  const stages = await getPipelineStages(pipelineId);
  const dealsByStage = await getDealsByPipeline(pipelineId);

  const stageCounts: Record<string, number> = {};
  for (const stage of stages) {
    stageCounts[stage.id] = dealsByStage[stage.id]?.length || 0;
  }

  const conversionData: PipelineConversion[] = [];
  for (let i = 0; i < stages.length; i++) {
    const currentStage = stages[i];
    const currentCount = stageCounts[currentStage.id];
    let conversionToNext: number | undefined = undefined;

    if (i < stages.length - 1) {
      const nextStage = stages[i + 1];
      const nextCount = stageCounts[nextStage.id];
      if (currentCount > 0) {
        conversionToNext = Math.round((nextCount / currentCount) * 100);
      }
    }

    conversionData.push({
      stage_id: currentStage.id,
      stage_name: currentStage.name,
      count: currentCount,
      conversion_to_next: conversionToNext,
    });
  }

  return conversionData;
}

export type PipelineConversion = {
  stage_id: string;
  stage_name: string;
  count: number;
  conversion_to_next?: number;
};
