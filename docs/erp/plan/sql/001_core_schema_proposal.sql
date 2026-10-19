-- ISOLINE / PostgreSQL 16+ : BAŞLANGIÇ TASLAĞI. Production migration değildir.
-- Özellikle RLS, grant, user context, SECURITY DEFINER ve auth API için güvenlik incelemesi şarttır.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE core.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('company','advisory','partner')),
  lifecycle text NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('provisional','active','suspended','closed')),
  region text NOT NULL DEFAULT 'eu',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  oidc_subject text UNIQUE,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  user_id uuid NOT NULL REFERENCES core.identities(id),
  role text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(tenant_id, user_id)
);
CREATE TABLE core.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  name text NOT NULL, country_code char(2) NOT NULL,
  registration_ref text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_tenant_id, id)
);
CREATE TABLE core.legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  organization_id uuid NOT NULL,
  name text NOT NULL, valid_from date,
  valid_to date, FOREIGN KEY (owner_tenant_id, organization_id)
    REFERENCES core.organizations(owner_tenant_id, id),
  UNIQUE(owner_tenant_id,id), CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);
CREATE TABLE core.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  legal_entity_id uuid NOT NULL,
  name text NOT NULL, country_code char(2),
  valid_from date, valid_to date,
  FOREIGN KEY(owner_tenant_id,legal_entity_id) REFERENCES core.legal_entities(owner_tenant_id,id),
  UNIQUE(owner_tenant_id,id)
);
CREATE TABLE core.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  advisory_tenant_id uuid REFERENCES core.tenants(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','accepted','active','review','closed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_tenant_id,id)
);
CREATE TABLE core.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  engagement_id uuid,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'planning',
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (owner_tenant_id, engagement_id) REFERENCES core.engagements(owner_tenant_id,id),
  FOREIGN KEY (owner_tenant_id, organization_id) REFERENCES core.organizations(owner_tenant_id,id),
  UNIQUE(owner_tenant_id,id)
);
CREATE TABLE core.reporting_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  project_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  report_kind text NOT NULL,
  status text NOT NULL DEFAULT 'planning',
  FOREIGN KEY(owner_tenant_id,project_id) REFERENCES core.projects(owner_tenant_id,id),
  UNIQUE(owner_tenant_id,id), CHECK (period_end >= period_start)
);
CREATE TABLE core.reporting_boundaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  reporting_cycle_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('ghg_operational_control','ghg_financial_control','ghg_equity_share','financial_reporting','cbam_facility_product')),
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  FOREIGN KEY(owner_tenant_id,reporting_cycle_id) REFERENCES core.reporting_cycles(owner_tenant_id,id),
  UNIQUE(owner_tenant_id,id), UNIQUE(reporting_cycle_id,kind,revision)
);
CREATE TABLE core.external_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  recipient_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  project_id uuid NOT NULL,
  role text NOT NULL, scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  granted_by uuid NOT NULL REFERENCES core.identities(id),
  FOREIGN KEY(owner_tenant_id,project_id) REFERENCES core.projects(owner_tenant_id,id),
  CHECK (owner_tenant_id <> recipient_tenant_id)
);
CREATE TABLE core.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  project_id uuid NOT NULL,
  assignee_user_id uuid REFERENCES core.identities(id),
  reviewer_user_id uuid REFERENCES core.identities(id),
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  due_at timestamptz, row_version bigint NOT NULL DEFAULT 1,
  FOREIGN KEY(owner_tenant_id,project_id) REFERENCES core.projects(owner_tenant_id,id),
  CHECK(assignee_user_id IS DISTINCT FROM reviewer_user_id)
);
CREATE TABLE core.evidence_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  project_id uuid NOT NULL,
  storage_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  sha256 char(64) NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
  classification text NOT NULL DEFAULT 'internal',
  scan_status text NOT NULL DEFAULT 'pending',
  uploaded_by uuid NOT NULL REFERENCES core.identities(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(owner_tenant_id,project_id) REFERENCES core.projects(owner_tenant_id,id),
  UNIQUE(owner_tenant_id,id)
);
CREATE TABLE core.metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL, unit_code text NOT NULL,
  aggregator text NOT NULL CHECK(aggregator IN ('sum','weighted_avg','ratio','last_value','custom'))
);
CREATE TABLE core.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  reporting_cycle_id uuid NOT NULL,
  metric_definition_id uuid NOT NULL REFERENCES core.metric_definitions(id),
  facility_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  value_num numeric(38,12),
  value_text text, unit_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  entered_by uuid NOT NULL REFERENCES core.identities(id),
  source_quality text NOT NULL DEFAULT 'measured',
  row_version bigint NOT NULL DEFAULT 1,
  FOREIGN KEY(owner_tenant_id,reporting_cycle_id) REFERENCES core.reporting_cycles(owner_tenant_id,id),
  FOREIGN KEY(owner_tenant_id,facility_id) REFERENCES core.facilities(owner_tenant_id,id),
  UNIQUE(owner_tenant_id,id),
  CHECK(period_end >= period_start),
  CHECK((value_num IS NOT NULL) <> (value_text IS NOT NULL))
);
CREATE TABLE core.calculation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  reporting_cycle_id uuid NOT NULL,
  boundary_id uuid NOT NULL,
  engine_version text NOT NULL,
  factor_set_version text NOT NULL,
  input_digest char(64) NOT NULL,
  output_digest char(64) NOT NULL,
  result_json jsonb NOT NULL,
  performed_by uuid NOT NULL REFERENCES core.identities(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(owner_tenant_id,reporting_cycle_id) REFERENCES core.reporting_cycles(owner_tenant_id,id),
  FOREIGN KEY(owner_tenant_id,boundary_id) REFERENCES core.reporting_boundaries(owner_tenant_id,id),
  UNIQUE(owner_tenant_id,id)
);
CREATE TABLE core.metric_fact_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  reporting_cycle_id uuid NOT NULL,
  metric_definition_id uuid NOT NULL REFERENCES core.metric_definitions(id),
  calculation_run_id uuid,
  revision integer NOT NULL,
  value_num numeric(38,12),
  value_text text,
  unit_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  supersedes_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(owner_tenant_id,reporting_cycle_id) REFERENCES core.reporting_cycles(owner_tenant_id,id),
  FOREIGN KEY(owner_tenant_id,calculation_run_id) REFERENCES core.calculation_runs(owner_tenant_id,id),
  FOREIGN KEY(owner_tenant_id,supersedes_id) REFERENCES core.metric_fact_versions(owner_tenant_id,id),
  UNIQUE(owner_tenant_id,id)
);
CREATE TABLE core.evidence_links (
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  evidence_id uuid NOT NULL,
  fact_version_id uuid NOT NULL,
  PRIMARY KEY(owner_tenant_id,evidence_id,fact_version_id),
  FOREIGN KEY(owner_tenant_id,evidence_id) REFERENCES core.evidence_objects(owner_tenant_id,id),
  FOREIGN KEY(owner_tenant_id,fact_version_id) REFERENCES core.metric_fact_versions(owner_tenant_id,id)
);
CREATE TABLE core.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_tenant_id uuid NOT NULL REFERENCES core.tenants(id),
  actor_user_id uuid REFERENCES core.identities(id),
  project_id uuid,
  action text NOT NULL,
  object_type text NOT NULL,
  object_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_scope ON core.tasks(owner_tenant_id,project_id,status,due_at);
CREATE INDEX idx_obs_scope ON core.observations(owner_tenant_id,reporting_cycle_id,metric_definition_id,period_start);
CREATE INDEX idx_grants_active ON core.external_grants(owner_tenant_id,recipient_tenant_id,project_id,expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_audit_tenant ON core.audit_events(owner_tenant_id,occurred_at DESC);

-- NOT: RLS aşağıda sadece tenant-üyeliği için illustrative SELECT'tir; dış proje grant'lerini
-- VE uygulama rol/ABAC kurallarını kapsamaz. Production kullanılmamalıdır.
ALTER TABLE core.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.projects FORCE ROW LEVEL SECURITY;
-- Runtime bağlantı rolü owner / BYPASSRLS olmamalı. app.user_id yalnız trusted API transaction'ında atanır.
CREATE POLICY project_select_member_example ON core.projects FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM core.memberships m
    WHERE m.tenant_id = projects.owner_tenant_id
      AND m.user_id = nullif(current_setting('app.user_id',true),'')::uuid
      AND m.revoked_at IS NULL
  )
);
-- Üretim öncesi ayrıca INSERT/UPDATE/DELETE deny-by-default, external grants, index ve tenant ID
-- consistency kontrolleri ve rol grants hazırlanmalıdır. Bu DDL eksiksiz yetki modeli değildir.
