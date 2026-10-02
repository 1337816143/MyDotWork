# UI version and appearance

Local v1.6 adds a persistent version, appearance, location and canonical-workbench strip. The historical 126-entry report now labels its scope and returns to the current workbench. Historical evidence dates remain unchanged.

The revised mobile header is one 60px row with brand, small version badge, appearance popover and menu. Workspace and research use one contextual tab row. Catalogue search stays visible; task/type/date/access/sort controls move into a native modal drawer on phones. Research metrics retain their evidence notes behind a disclosure. At 390×844 the first complete catalogue card and first two comparison quotes must fit without scrolling. The separate compact browser suite captures 320/390/768/1280 in all three appearances and measures actual placeholder pseudo-elements, hint text and disabled controls.

Appearance preferences restore synchronously in the document head before the body exists. B dark, B light and A light remain available; only appearance preferences use local storage. Liquid glass is limited to navigation and a few outer surfaces. Data, text, tables and dialogs keep opaque backgrounds. A lightweight switch, reduced-motion preference and constrained-device detection disable blur. No new service, tracking or account is introduced.

Fresh online Evolution v1.5 verification is separate from local v1.6 verification. The online mirror passed all three appearances at 1280, 768 and 390 pixels, including filters, default-closed mobile navigation and keyboard controls. Screenshots are actual Chrome captures.

Task 3 and task 5 Library files were not integrated: the current official materialization helper requires os.setxattr, unavailable on this Windows host. No helper patch or metadata bypass was used. The catalogue remains the reviewed public repository whitelist.

Publishing remains with the parent coordinator. Rebuild using the final release SHA and include dashboard/catalog.json in the My-Evolution mirror whitelist; the existing publish process then updates Evolution. Do not deploy the local reference manifest as a final release manifest.
