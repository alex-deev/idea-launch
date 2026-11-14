-- Migrate deliverable specs and demo payloads from v1 (single deliverable) to v2 (multi-target bundle).
-- Deterministic mapping: WEB_LINK->WEB, MOBILE_BUILD(+platform)->MOBILE_*, DESKTOP_BUILD(+os)->DESKTOP_*,
-- SOURCE_PACKAGE/DOCUMENT/OTHER/default -> WEB. Uniform targets across all milestones per offer/project.

CREATE OR REPLACE FUNCTION pg_temp.v1_spec_to_slot(spec jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN spec->>'kind' = 'MOBILE_BUILD' AND spec->>'platform' = 'IOS' THEN
      jsonb_build_object('target','MOBILE_IOS','kind','MOBILE_BUILD','platform','IOS','label',spec->'label','notes',spec->'notes')
    WHEN spec->>'kind' = 'MOBILE_BUILD' AND spec->>'platform' = 'ANDROID' THEN
      jsonb_build_object('target','MOBILE_ANDROID','kind','MOBILE_BUILD','platform','ANDROID','label',spec->'label','notes',spec->'notes')
    WHEN spec->>'kind' = 'MOBILE_BUILD' THEN
      jsonb_build_object('target','MOBILE_CROSS_PLATFORM','kind','MOBILE_BUILD','platform','CROSS_PLATFORM','label',spec->'label','notes',spec->'notes')
    WHEN spec->>'kind' = 'DESKTOP_BUILD' AND spec->>'os' = 'MACOS' THEN
      jsonb_build_object('target','DESKTOP_MACOS','kind','DESKTOP_BUILD','os','MACOS','label',spec->'label','notes',spec->'notes')
    WHEN spec->>'kind' = 'DESKTOP_BUILD' AND spec->>'os' = 'LINUX' THEN
      jsonb_build_object('target','DESKTOP_LINUX','kind','DESKTOP_BUILD','os','LINUX','label',spec->'label','notes',spec->'notes')
    WHEN spec->>'kind' = 'DESKTOP_BUILD' THEN
      jsonb_build_object('target','DESKTOP_WINDOWS','kind','DESKTOP_BUILD','os','WINDOWS','label',spec->'label','notes',spec->'notes')
    ELSE
      jsonb_build_object('target','WEB','kind','WEB_LINK','label',CASE WHEN spec->>'kind' IN ('SOURCE_PACKAGE','DOCUMENT','OTHER') THEN spec->'label' ELSE NULL END,'notes',spec->'notes')
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_spec_to_bundle(spec jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'version', 2,
    'targets', jsonb_build_array((pg_temp.v1_spec_to_slot(COALESCE(spec,'{}'::jsonb))->>'target')),
    'slots', jsonb_build_array(pg_temp.v1_spec_to_slot(COALESCE(spec,'{}'::jsonb)))
  );
$$;

-- 1) Milestone.deliverableSpec
UPDATE "Milestone"
SET "deliverableSpec" = pg_temp.v1_spec_to_bundle("deliverableSpec")
WHERE "deliverableSpec" IS NOT NULL
  AND ("deliverableSpec"->>'version') IS DISTINCT FROM '2';

UPDATE "Milestone"
SET "deliverableSpec" = pg_temp.v1_spec_to_bundle(jsonb_build_object('kind','WEB_LINK'))
WHERE "deliverableSpec" IS NULL;

-- 2) Offer.milestonesSnapshot: uniform per offer (derive from first item's deliverable)
WITH converted AS (
  SELECT
    o.id,
    jsonb_agg(
      jsonb_set(
        elem,
        '{deliverable}',
        pg_temp.v1_spec_to_bundle(COALESCE(o."milestonesSnapshot"->0->'deliverable', elem->'deliverable', jsonb_build_object('kind','WEB_LINK')))
      )
      ORDER BY ord
    ) AS snap
  FROM "Offer" o
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o."milestonesSnapshot",'[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
  WHERE o."milestonesSnapshot" IS NOT NULL
    AND jsonb_typeof(o."milestonesSnapshot") = 'array'
  GROUP BY o.id
)
UPDATE "Offer" o
SET "milestonesSnapshot" = c.snap
FROM converted c
WHERE o.id = c.id
  AND (COALESCE(o."milestonesSnapshot",'[]'::jsonb)->0->'deliverable'->>'version') IS DISTINCT FROM '2';

-- 3) DEMO_WIDGET messages
WITH msg AS (
  SELECT
    m.id,
    m.payload,
    m.content,
    COALESCE(m.payload->'deliverable', jsonb_build_object(
      'title', COALESCE(m.content,'Submission'),
      'accessUrl', COALESCE(m.payload->>'demoUrl', m.payload->>'accessUrl', m.content, ''),
      'instructions', 'See the provided link for access and review instructions.'
    )) AS deliv,
    COALESCE(ms."deliverableSpec", pg_temp.v1_spec_to_bundle(jsonb_build_object('kind','WEB_LINK'))) AS spec
  FROM "Message" m
  LEFT JOIN "Milestone" ms ON ms.id = (m.payload->>'milestoneId')
  WHERE m.type = 'DEMO_WIDGET'
    AND (m.payload->>'specVersion') IS DISTINCT FROM '2'
    AND (m.payload->'bundle') IS NULL
), built AS (
  SELECT
    id,
    content,
    (spec->'slots'->0) AS slot,
    (spec->'targets'->0) AS target,
    deliv,
    payload,
    COALESCE(deliv->>'accessUrl', payload->>'demoUrl', payload->>'accessUrl', content, '') AS url
  FROM msg
)
UPDATE "Message" m
SET
  payload = jsonb_strip_nulls(jsonb_build_object(
    'milestoneId', m.payload->'milestoneId',
    'specVersion', 2,
    'submittedAt', COALESCE(m.payload->>'submittedAt', to_char(m."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'bundle', jsonb_build_object('slots', jsonb_build_array(jsonb_build_object(
      'target', b.target,
      'deliverable', jsonb_strip_nulls(jsonb_build_object(
        'kind', b.slot->>'kind',
        'platform', b.slot->'platform',
        'os', b.slot->'os',
        'title', COALESCE(NULLIF(b.deliv->>'title',''), 'Submission'),
        'accessUrl', b.url,
        'instructions', COALESCE(NULLIF(b.deliv->>'instructions',''), 'See the provided link for access and review instructions.'),
        'version', b.deliv->'version',
        'credentials', b.deliv->'credentials',
        'summary', b.deliv->'summary'
      ))
    ))),
    'whatChanged', b.payload->'whatChanged',
    'demoUrl', b.url,
    'accessUrl', b.url,
    'latePenalty', COALESCE((b.payload->>'latePenalty')::int, 0),
    'revisionOverdue', COALESCE((b.payload->>'revisionOverdue')::boolean, false),
    'resubmission', COALESCE((b.payload->>'resubmission')::boolean, false)
  )),
  content = 'Bundle submitted (1 target)'
FROM built b
WHERE m.id = b.id;
