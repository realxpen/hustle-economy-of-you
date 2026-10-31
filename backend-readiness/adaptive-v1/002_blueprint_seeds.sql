-- Hustle adaptive versioned default service blueprints
-- DRAFT ONLY; run after reviewed 001_schema.sql in an isolated test DB.
-- Published definitions are immutable; edits must insert a new version.
BEGIN;
INSERT INTO adaptive.service_blueprints(slug,version,type,definition,published_at)
VALUES
 ('appointment',1,'appointment','{"label":"Appointment","description":"Scheduled individual services","icon":"◷","steps":["Request","Availability","Approval","Service","Confirmation"],"features":["calendar","staff","location","reference","consultation"],"example":"Barber, makeup artist"}'::jsonb,now()),
 ('item',1,'item','{"label":"Item-based job","description":"Collect, work on and return items","icon":"▤","steps":["Intake","Quote","Handover","In progress","Ready","Return","Approval"],"features":["intake","measurements","turnaround","delivery","evidence"],"example":"Laundry, tailor, shoemaker"}'::jsonb,now()),
 ('project',1,'project','{"label":"Project","description":"Scoped work with milestones","icon":"▥","steps":["Brief","Proposal","Agreement","Milestones","Delivery","Approval"],"features":["brief","files","milestones","revisions","contract"],"example":"Renovation, software, interiors"}'::jsonb,now()),
 ('group',1,'group','{"label":"Shared session","description":"One session for multiple participants","icon":"◎","steps":["Enroll","Schedule","Attendance","Session","Follow-up"],"features":["seats","calendar","attendance","learning"],"example":"Tutors and workshops"}'::jsonb,now()),
 ('event',1,'event','{"label":"Event","description":"Staff, venue and logistics","icon":"✧","steps":["Requirements","Availability","Quote","Preparation","Event","Approval"],"features":["venue","resources","team","logistics","milestones"],"example":"Weddings, catering, photography"}'::jsonb,now()),
 ('product',1,'product','{"label":"Product","description":"Inventory and fulfilment","icon":"▣","steps":["Select","Checkout","Stock allocation","Dispatch","Delivery","Return window"],"features":["variants","inventory","cart","shipping","returns"],"example":"Crafts, clothing and goods"}'::jsonb,now()),
 ('digital',1,'digital','{"label":"Digital deliverable","description":"Remote commissions and files","icon":"⌘","steps":["Brief","Proposal","Create","Review","Revisions","Acceptance"],"features":["brief","files","revisions","deadline"],"example":"Design, editing, consulting"}'::jsonb,now()),
 ('recurring',1,'recurring','{"label":"Recurring service","description":"Repeat jobs and renewals","icon":"↻","steps":["Plan","Schedule","Recurring work","Review","Renew"],"features":["cadence","subscription","staff","reminders"],"example":"Cleaning, maintenance"}'::jsonb,now()),
 ('live',1,'live','{"label":"Live experience","description":"Interactive paid or free sessions","icon":"●","steps":["Publish","Registration","Access","Live","Replay"],"features":["stream","admission","chat","replay"],"example":"Live selling and classes"}'::jsonb,now())
ON CONFLICT (slug,version) DO NOTHING;
COMMIT;
