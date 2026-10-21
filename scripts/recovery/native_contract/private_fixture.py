#!/usr/bin/env python3
"""Exercise the private-copy adapter with ten generated files, never Drive."""
import gzip
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile

spec = importlib.util.spec_from_file_location("hustle_private_adapter", Path(__file__).with_name("private_cloud.py"))
private = importlib.util.module_from_spec(spec)
spec.loader.exec_module(private)
access, core, cloud = private.access, private.core, private.cloud


def generated_contract():
    source = access.Stack()
    try:
        source.start_database()
        access.private_sql(source.database, access.FIXTURE_SETUP)
        source.services(fixture=True)
        access.private_sql(source.database, access.FIXTURE_AUTH_HELPERS)
        owner, outsider = source.create_generated_account(), source.create_generated_account()
        access.private_sql(source.database, 'INSERT INTO public."User" VALUES(' + access.sql_literal(owner["id"]) + '),(' + access.sql_literal(outsider["id"]) + ');')
        payloads = {}
        for bucket, public in (("hustler-proofs", False), ("fixture-public", True)):
            response = source.request("storage", "/bucket", method="POST", token=source.service_token,
                                      body={"id": bucket, "name": bucket, "public": public})
            core.require(response["status"] in (200, 201), "PRIVATE_FIXTURE_BUCKET", "Generated bucket setup failed.")
            for index in range(2 if public else 8):
                name = ("" if public else owner["id"] + "/") + "generated-" + str(index) + ".txt"
                payloads[(bucket, name)] = ("Generated recovery file " + bucket + str(index) + "\n").encode()
                response = source.request("storage", access.storage_path({"bucket_id": bucket, "name": name}),
                                          method="POST", token=source.service_token, binary=payloads[(bucket, name)])
                core.require(response["status"] in (200, 201), "PRIVATE_FIXTURE_UPLOAD", "A generated file could not be prepared.")
        access.private_sql(source.database, "CREATE POLICY fixture_proof_owner ON storage.objects FOR SELECT TO authenticated USING(bucket_id='hustler-proofs' AND (storage.foldername(name))[1]=auth.uid()::text);")
        reference = access.reference_from_files(source.database.catalog(), payloads)
        reference.update(source_project_ref=core.PROJECT, cross_service_atomic=False)
        password = "generated-private-adapter-fixture-only"
        with tempfile.TemporaryDirectory(prefix="hustle-generated-private-adapter-") as directory:
            folder = Path(directory)
            for suffix, command in (("-roles.sql.enc", source.database.command("pg_dumpall", ["--roles-only", "--no-role-passwords", "--database=postgres"])),
                                    ("-database.pgdump.enc", source.database.command("pg_dump", ["--dbname=postgres", "--format=custom", "--quote-all-identifiers", "--no-subscriptions"]))):
                core.encrypt_fixture(folder / (core.SET_ID + suffix), password, command=command)
            core.encrypt_fixture(folder / (core.SET_ID + "-catalog.json.gz.enc"), password,
                                 data=gzip.compress(core.canonical(reference)))
            stream = io.BytesIO()
            with tarfile.open(fileobj=stream, mode="w:gz") as archive:
                records = [(r["relative_path"], payloads[(r["bucket_id"], r["name"])]) for r in reference["file_hashes"]]
                records += [("file-hashes.json", core.canonical({"source_project_ref": core.PROJECT, "files": reference["file_hashes"]})),
                            ("storage-catalog.json", core.canonical({"buckets": reference["before"]["buckets"], "objects": reference["before"]["objects"]}))]
                for name, data in records:
                    member = tarfile.TarInfo(name)
                    member.size, member.mode = len(data), 0o600
                    archive.addfile(member, io.BytesIO(data))
            core.encrypt_fixture(folder / (core.SET_ID + "-storage_files.tar.gz.enc"), password, data=stream.getvalue())
            source.cleanup()
            result = private.restore_copy(folder, private.Inputs("", password, owner["email"], owner["password"]))
            core.require(result == {"owner_private_proofs_byte_verified": 8, "public_original_files_byte_verified": 2},
                         "PRIVATE_FIXTURE_ACCESS", "The generated private-copy adapter did not verify all expected access cases.")
    finally:
        source.cleanup()


def main():
    try:
        cloud.preflight()
        cloud.assert_clean()
        generated_contract()
        cloud.assert_clean()
        print("GENERATED PRIVATE-COPY ADAPTER PASSED: 10 files, original generated owner login/refresh and private/public access.")
        print("No Drive, actual backup or original user credentials were accessed.")
        return 0
    except core.RestoreError as error:
        print("[" + error.code + "] " + error.message)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
