import nx from "@nx/eslint-plugin";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    {
        ignores: [
            "**/dist",
            "**/out-tsc"
        ]
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx"
        ],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [
                        String.raw`^.*/eslint(\.base)?\.config\.[cm]?[jt]s$`
                    ],
                    depConstraints: [
                        {
                            sourceTag: "scope:frontend",
                            onlyDependOnLibsWithTags: [
                                "scope:shared"
                            ]
                        },
                        {
                            sourceTag: "scope:backend",
                            onlyDependOnLibsWithTags: [
                                "scope:shared"
                            ]
                        },
                        {
                            sourceTag: "scope:shared",
                            onlyDependOnLibsWithTags: [
                                "scope:shared"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.cts",
            "**/*.mts",
            "**/*.js",
            "**/*.jsx",
            "**/*.cjs",
            "**/*.mjs"
        ],
        // Override or add rules here
        rules: {}
    }
];
