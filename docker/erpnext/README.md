# ERPNext container integration

The root `compose.yml` is a small local adaptation of the MIT-licensed [frappe/frappe_docker](https://github.com/frappe/frappe_docker) project, using its base Compose service roles and database/Redis overrides. Sources inspected on 2026-11-15:

- [Base Compose](https://github.com/frappe/frappe_docker/blob/main/compose.yaml)
- [MariaDB override](https://github.com/frappe/frappe_docker/blob/main/overrides/compose.mariadb.yaml)
- [Redis override](https://github.com/frappe/frappe_docker/blob/main/overrides/compose.redis.yaml)
- [Example versions](https://github.com/frappe/frappe_docker/blob/main/example.env)
- [Frappe v16 site commands](https://github.com/frappe/frappe/blob/version-16/frappe/commands/site.py)

Upstream references move, but this repository stores the actual Compose configuration and explicit candidate image tags; setup never downloads upstream YAML. Final image digests remain a workshop validation decision.

Adaptations: loopback HTTP binding, a fixed single-site header, health-based infrastructure waits, separate one-off setup profiles, explicit site database password, persistent logs/queues, and a guarded reset. `configure.sh` writes common Frappe service settings. `init-site.sh` checks an existing site before installing missing ERPNext and refuses to overwrite a partial site directory. Both execute only inside the ERPNext container. No custom Dockerfile is needed while only the bundled Frappe/ERPNext apps are used. Custom apps may later require the upstream custom-image workflow.

The earlier native Bench guide is preserved in `docs/archive/`; it is not a host prerequisite. See [the current setup guide](../../docs/setup-erpnext.md).

Upstream license for adapted configuration:

```text
MIT License

Copyright (c) 2017 Frappe Technologies Pvt. Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
