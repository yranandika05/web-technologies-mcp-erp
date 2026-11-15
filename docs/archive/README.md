# Historical OFBiz prototype

`README-ofbiz.md`, `setup-ofbiz.sh` and `start-ofbiz.sh` preserve the previous prototype unchanged. Paths and instructions in these files describe the old layout, not the current setup.

The scripts are archival references, not runnable entry points in this location: they derive the project root from their parent directory. The old setup script also checks out an OFBiz revision and resets demo data. Do not run it as part of the ERPNext setup.

The original README documents revision `27ca871d3212468196f3ae7cbc02ab08880207d3`, product `GZ-2644`, the tested JWT authentication route and BOM Management request. Credentials shown there are historical default demo credentials, not ERPNext credentials.

`setup-erpnext-native-bench.md` preserves the superseded native Bench proposal for historical context. Its commands are not the current workflow; use [the Docker setup guide](../setup-erpnext.md). The former Bench checker wrappers were replaced by Docker scripts.
