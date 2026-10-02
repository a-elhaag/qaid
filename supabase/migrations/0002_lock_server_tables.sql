-- Server-only tables: RLS on with no policies = anon/authenticated denied, service role bypasses.
alter table expected_docs enable row level security;
alter table employees enable row level security;
alter table jobs enable row level security;
alter table chat_messages enable row level security;

alter function claim_job() set search_path = public;
revoke execute on function claim_job() from public, anon, authenticated;
revoke execute on function my_office_ids() from public, anon;
grant execute on function my_office_ids() to authenticated;
