# Gerrit Code Review Workflow - Code Buster

```mermaid
flowchart TD
    A["1. Developer creates feature branch"]
    B["2. Developer makes commits locally"]
    C["3. Push to Gerrit via refs/for/&lt;branch&gt;"]
    D{"4. Gerrit receives change"}
    E["5. CI/CD checks run"]
    F["6. Reviewers comment & vote"]
    G{"7. Approved?"}
    H["8. Gerrit merges into main branch"]
    I["9. Developer amends commit & re-pushes"]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G -->|"+2 Code-Review\n+1 Verified"| H
    G -->|"-1 / -2\nChanges requested"| I
    I -->|"Same Change-Id preserved"| C

    %% Notes
    N1["Change-Id: I{hash}\nTracked across patchsets"]
    N2["Unit Tests\nLint / Static Analysis\nSecurity Scan (CodeQL)"]
    N3["+2 = Looks good, approve\n+1 = Looks good, no authority\n-1 = Needs changes\n-2 = Do not submit"]
    N4["Submit type:\nMerge / Cherry-Pick / Rebase"]

    C -.- N1
    E -.- N2
    F -.- N3
    H -.- N4

    %% Styles
    classDef start fill:#2d6a4f,stroke:#1b4332,color:#fff,stroke-width:2px
    classDef dev fill:#264653,stroke:#1d3557,color:#fff,stroke-width:2px
    classDef gerrit fill:#e76f51,stroke:#c1440e,color:#fff,stroke-width:2px
    classDef ci fill:#e9c46a,stroke:#c9a227,color:#000,stroke-width:2px
    classDef review fill:#457b9d,stroke:#1d3557,color:#fff,stroke-width:2px
    classDef decision fill:#f4a261,stroke:#e76f51,color:#000,stroke-width:2px
    classDef merge fill:#2a9d8f,stroke:#264653,color:#fff,stroke-width:2px
    classDef note fill:#f1faee,stroke:#a8dadc,color:#333,stroke-width:1px,font-size:12px

    class A start
    class B,I dev
    class C,D gerrit
    class E ci
    class F review
    class G decision
    class H merge
    class N1,N2,N3,N4 note
```

## Workflow Summary

| Step | Action | Actor |
|------|--------|-------|
| 1 | Create feature branch from main | Developer |
| 2 | Make commits locally with `Change-Id` in commit message | Developer |
| 3 | Push via `git push origin HEAD:refs/for/main` | Developer |
| 4 | Change registered, patchset created | Gerrit |
| 5 | CI/CD pipeline triggered (unit tests, lint, security scan) | Automated |
| 6 | Reviewers examine diff, leave comments, cast votes | Reviewers |
| 7 | Decision: approved (+2) or changes requested (-1/-2) | Reviewers |
| 8 | Change merged into target branch | Gerrit |
| 9 | If rejected: amend commit, keep same Change-Id, re-push | Developer |

## Key Concepts

- **Change-Id**: A unique identifier (`Change-Id: I...`) in the commit message that links all patchsets of the same logical change.
- **Patchset**: Each re-push with the same Change-Id creates a new patchset on the same Gerrit change.
- **Voting Labels**: `Code-Review` (+2/+1/-1/-2) and `Verified` (+1/-1) from CI.
- **Submit Rules**: Requires at least one +2 on Code-Review and +1 on Verified (no -2 blocking).
