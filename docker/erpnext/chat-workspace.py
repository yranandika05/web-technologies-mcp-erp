"""Creates (or updates) the "MCP Chat" workspace that embeds the chat host via iframe.

Runs inside the backend container (see scripts/setup-chat-workspace.sh). Idempotent:
running it again only updates the iframe URL.
"""
import json
import os

import frappe

NAME = "MCP Chat"
SITE = os.environ["SITE_NAME"]
CHAT_URL = os.environ.get("CHAT_URL", "http://localhost:3000")

IFRAME = (
    f'<iframe src="{CHAT_URL}" title="MCP Chat" '
    'style="width:100%;height:75vh;border:0;border-radius:8px"></iframe>'
)


def upsert(doctype, name, values):
    doc = frappe.get_doc(doctype, name) if frappe.db.exists(doctype, name) else frappe.new_doc(doctype)
    doc.update(values)
    doc.save(ignore_permissions=True) if not doc.is_new() else doc.insert(ignore_permissions=True)
    return doc


frappe.init(site=SITE, sites_path=".")
frappe.connect()
try:
    upsert("Custom HTML Block", NAME, {"name": NAME, "html": IFRAME, "private": 0})

    content = [{"id": "mcpchat01", "type": "custom_block", "data": {"custom_block_name": NAME, "col": 12}}]
    upsert(
        "Workspace",
        NAME,
        {
            "label": NAME,
            "title": NAME,
            "module": "Stock",  # v16 lists public workspaces in their module sidebar: Lager -> MCP Chat
            "type": "Workspace",
            "public": 1,
            "icon": "message",
            "content": json.dumps(content),
            "custom_blocks": [{"custom_block_name": NAME, "label": NAME}],
        },
    )

    frappe.db.commit()
    print(f"Workspace '{NAME}' ready, iframe -> {CHAT_URL}")
finally:
    frappe.destroy()
