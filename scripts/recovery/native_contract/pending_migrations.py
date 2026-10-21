#!/usr/bin/env python3
"""Rehearse five reviewed SQL files on owned, network-disabled PG17 copies.

No Prisma/Supabase ledger is stamped. Original row contents are hashed INSIDE
PostgreSQL using the original column projection; only digests reach this process.
"""
import hashlib
import json

import migration_audit as audit

access, core, cloud = audit.access, audit.core, audit.cloud
PENDING_HASHES = dict(zip(audit.PENDING, (
    'd5f9df5245c923fb96bfc6b3689138ce821a64f0f4c34e1dbec2f475571c1105',
    'aebf337fbee8a8e68db4e3228528a9d88c38e25264e264f79a9614ee77024818',
    '08018458868d74e4e8174c31b1b77f1e542d571717f1164b4b8875b711a0b2a3',
    '64f66d2cba8f919e97c7a1ad3bde53d5aa7e09768211d8957c882bc48a4f405a',
    '4301ecd3a0e617fd15382daa384c1a81e7df2ddb67bb481df2c7819e7a917173',
)))
NEW_TABLES = ('FinancialDispatchCommand', 'MoniflowSandboxReceiptObservation', 'BookingScheduleRevision')

TABLES = """BEGIN READ ONLY;
SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,
 'columns',(SELECT jsonb_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a
  WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname,c.relname),'[]'::jsonb)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','auth','storage','supabase_migrations') AND c.relkind IN ('r','p');
COMMIT;"""


def ident(value):
    core.require(isinstance(value, str) and 0 < len(value.encode()) <= 63 and '\0' not in value,
                 'REHEARSAL_IDENTIFIER', 'A catalog identifier was invalid.')
    return '"' + value.replace('"', '""') + '"'


def original_tables(database):
    return json.loads(access.private_sql(database, TABLES))


def fingerprint_sql(table):
    core.require(table['schema'] in ('public','auth','storage','supabase_migrations') and table['columns'],
                 'REHEARSAL_TABLE', 'Only original application and recovery tables may be hashed.')
    columns = ','.join(ident(c) for c in table['columns'])
    relation = ident(table['schema']) + '.' + ident(table['table'])
    return """BEGIN READ ONLY;
SET LOCAL timezone='UTC'; SET LOCAL extra_float_digits=3; SET LOCAL bytea_output='hex';
SET LOCAL statement_timeout='30s';
WITH rows AS (SELECT encode(sha256(convert_to(row_to_json(t)::text,'UTF8')),'hex') AS h
 FROM (SELECT """ + columns + ' FROM ' + relation + """ ) t)
SELECT jsonb_build_object('count',count(*),'sha256',
 encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex')) FROM rows;
COMMIT;"""


def fingerprints(database, tables):
    # No row values, per-table digests or private identifiers are printed or
    # included in the result artifact. Keep these comparison receipts in memory.
    return {(t['schema'],t['table']): json.loads(access.private_sql(database, fingerprint_sql(t))) for t in tables}


def pending_sql():
    audit.inventory()
    chunks = []
    for name in audit.PENDING:
        raw = (audit.MIGRATIONS / name / 'migration.sql').read_bytes()
        core.require(hashlib.sha256(raw).hexdigest() == PENDING_HASHES[name],
                     'REHEARSAL_SQL_CHANGED', 'A reviewed pending SQL file changed; review before running it.')
        chunks.append(raw.decode())
    return "BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SET LOCAL ROLE postgres;\n" + '\n'.join(chunks) + '\nCOMMIT;'


def apply_pending(database):
    access.private_sql(database, pending_sql())


def pending_reference(database, before):
    apply_pending(database)
    after = audit.snapshot(database)
    affected = sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))
    core.require(affected and all('relation:' + name in affected for name in NEW_TABLES),
                 'REHEARSAL_REFERENCE', 'The pending reference did not create the expected structures.')
    return after, affected


def compare_after(before, after, expected, affected):
    differences = [k for k in affected if (k in expected) != (k in after) or expected.get(k) != after.get(k)]
    changed = {k for k in before.keys() | after.keys() if before.get(k) != after.get(k)}
    core.require(not differences and not (changed - set(affected)),
                 'REHEARSAL_SCHEMA', 'The migrated schema differed from the reviewed reference or changed unrelated objects.')


def verify_source_pending(database):
    result = json.loads(access.private_sql(database, """BEGIN READ ONLY;
SELECT jsonb_build_object('tables_absent',
 to_regclass('public."FinancialDispatchCommand"') IS NULL AND
 to_regclass('public."MoniflowSandboxReceiptObservation"') IS NULL AND
 to_regclass('public."BookingScheduleRevision"') IS NULL,
 'refund_index_absent',to_regclass('public."Refund_one_active_per_payment_idx"') IS NULL,
 'duplicate_active_refunds',(SELECT count(*) FROM
  (SELECT "paymentAttemptId" FROM public."Refund" WHERE "status" IN ('REQUESTED','PROCESSING','SUCCEEDED')
   GROUP BY "paymentAttemptId" HAVING count(*)>1) duplicates));
COMMIT;"""))
    core.require(result == {'tables_absent': True, 'refund_index_absent': True, 'duplicate_active_refunds': 0},
                 'REHEARSAL_SOURCE', 'Pending objects already existed or original refund rows violated the new unique index. No records were removed.')


def verify_defaults(database, require_existing):
    result = json.loads(access.private_sql(database, """BEGIN READ ONLY;
SELECT jsonb_build_object('services',(SELECT count(*) FROM public."Service"),
 'bookings',(SELECT count(*) FROM public."Booking"),
 'service_defaults',coalesce((SELECT bool_and("bookingMode"='APPOINTMENT' AND "bookingTimezone"='Africa/Lagos'
 AND "resourcePoolKey"='primary' AND "defaultDurationMinutes"=60 AND "prepMinutes"=0 AND "bufferMinutes"=0
 AND "parallelCapacity"=1 AND "overbookingAllowance"=0 AND "weeklyHours" IS NULL
 AND "blackoutDates"=ARRAY[]::text[] AND "maxActiveJobs"=10 AND "turnaroundHours"=48 AND "autoExtensionMinutes"=0)
 FROM public."Service"),true),
 'booking_defaults',coalesce((SELECT bool_and("scheduledDurationMinutes" IS NULL AND "extendedMinutes"=0
 AND "actualStartedAt" IS NULL AND "actualFinishedAt" IS NULL) FROM public."Booking"),true),
 'new_tables_empty',(SELECT count(*) FROM public."FinancialDispatchCommand")=0
  AND (SELECT count(*) FROM public."MoniflowSandboxReceiptObservation")=0
  AND (SELECT count(*) FROM public."BookingScheduleRevision")=0);
COMMIT;"""))
    core.require(result['service_defaults'] and result['booking_defaults'] and result['new_tables_empty']
        and (not require_existing or result['services'] > 0 and result['bookings'] > 0),
        'REHEARSAL_DEFAULTS', 'New fields did not preserve the reviewed defaults on existing data.')


def sandbox_sql(database, sql):
    database.guard()
    result = access.private_run(database.command('psql', ['--dbname=hustle_payment_sandbox', '-X', '-qAt',
        '-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-f','-'], True), data=sql.encode())
    if result.returncode:
        raise core.import_error('REHEARSAL_ACCESS', result.stderr)
    return result.stdout.strip()


def access_contracts(database):
    # Existing scripts require this fixed throwaway name. Clone INSIDE the same
    # owned network-disabled container; never remove their production guard.
    access.private_sql(database, 'CREATE DATABASE hustle_payment_sandbox TEMPLATE postgres;')
    for path in ('casework-access-check.sql','flowtime-revision-access-check.sql'):
        sandbox_sql(database, (audit.ROOT / 'scripts/experience' / path).read_text())
    response = sandbox_sql(database, """BEGIN;
INSERT INTO public."FinancialDispatchCommand"("id","kind","operationId","updatedAt")
 VALUES('generated-access-probe','PAYOUT','generated-access-probe',now());
INSERT INTO public."MoniflowSandboxReceiptObservation"
 ("id","eventId","operationId","kind","amountMinor","currency","commandDigest","receiptDigest","occurredAt")
 VALUES('generated-access-probe','generated-access-probe','generated-access-probe','PAYOUT',1,'NGN','generated','generated',now());
SET LOCAL ROLE anon;
SELECT jsonb_build_array((SELECT count(*) FROM public."FinancialDispatchCommand"),
 (SELECT count(*) FROM public."MoniflowSandboxReceiptObservation"));
SET LOCAL ROLE authenticated;
SELECT jsonb_build_array((SELECT count(*) FROM public."FinancialDispatchCommand"),
 (SELECT count(*) FROM public."MoniflowSandboxReceiptObservation"));
SET LOCAL ROLE hustle_api;
SELECT jsonb_build_array((SELECT count(*) FROM public."FinancialDispatchCommand"),
 (SELECT count(*) FROM public."MoniflowSandboxReceiptObservation"));
ROLLBACK;""")
    counts = [json.loads(line) for line in response.decode().splitlines()]
    core.require(counts == [[0,0],[0,0],[1,1]], 'REHEARSAL_ROW_ACCESS',
                 'Generated financial/receipt probes were not isolated from browser roles or visible to the API role.')


def generated_contract():
    database = core.Database()
    try:
        database.start()
        before_schema, _, _ = audit.reference_contract(database)
        verify_source_pending(database)
        access.private_sql(database, 'INSERT INTO public."SystemEvent"("id","name","source") VALUES(\'generated-rehearsal\',\'original\',\'generated\');')
        tables = original_tables(database)
        rows = fingerprints(database, tables)
        expected, affected = pending_reference(database, before_schema)
        core.require(fingerprints(database,tables) == rows, 'REHEARSAL_GENERATED_ROWS', 'Pending SQL changed generated original data.')
        compare_after(before_schema, audit.snapshot(database), expected, affected)
        verify_defaults(database, False)
        access_contracts(database)
        # Prove the original-column digest detects data changes rather than
        # relying on counts. Only a generated fixture row is changed here.
        access.private_sql(database, 'UPDATE public."SystemEvent" SET "name"=\'changed\' WHERE "id"=\'generated-rehearsal\';')
        core.require(fingerprints(database,tables) != rows, 'REHEARSAL_GENERATED_ROWS', 'The original row-content mutation escaped detection.')
    finally:
        database.cleanup()
    cloud.assert_clean()


if __name__ == '__main__':
    try:
        cloud.preflight()
        cloud.assert_clean()
        generated_contract()
        print('GENERATED PENDING SQL REHEARSAL PASSED: five pinned SQL files, original-row hashing, defaults, API/browser access and cleanup.')
        print('Generated data only; no actual saved-backup migration or Prisma history repair is claimed.')
    except core.RestoreError as error:
        print('[' + error.code + '] ' + error.message)
        raise SystemExit(1)
