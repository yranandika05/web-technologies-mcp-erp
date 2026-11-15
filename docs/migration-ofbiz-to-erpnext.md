# Migration from Apache OFBiz to ERPNext

Apache OFBiz was initially selected because it is a full open-source ERP system. The prototype proved that OFBiz can run locally, load demo data, authenticate REST requests using JWT and expose ERP data programmatically.

Discovering and using suitable endpoints required relatively high integration effort: investigating Swagger, WADL, API groups and OFBiz-specific services. The main difficulty was the discoverability and usability of the integration surface for this workshop prototype, rather than OFBiz's monolithic architecture.

ERPNext remains a real, open-source ERP system and is built on the Frappe Framework. Frappe provides a [consistent REST API](https://docs.frappe.io/framework/user/en/api/rest) for DocTypes and exposed server methods. This should let the workshop focus more strongly on MCP instead of ERP-specific API discovery.

The conceptual MCP architecture remains unchanged. Only the ERP-specific integration layer is being replaced: future MCP tools will call `packages/erpnext-client`, which will encapsulate ERPNext/Frappe HTTP communication.

The [original README](archive/README-ofbiz.md) preserves the pinned OFBiz revision, tested product, JWT authentication examples and endpoint findings. The original setup/start scripts are preserved alongside it. The existing ignored `.local/ofbiz-framework` runtime is untouched. This migration implements repository preparation only; ERPNext and its API still need local validation.
