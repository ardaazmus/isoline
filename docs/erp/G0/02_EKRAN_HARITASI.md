# G0-04 — Hedef ekran haritası

Plan 04'teki ekran kimlikleri, uygulamadaki rotalar, sahip rol ve kapı (G1–G8). Bütün rotalar `/[lang]` önekli. Platform rotaları `app/` altında, kimlik rotaları `auth/` altında.

Her ekranda ortak durum sözleşmesi geçerli (ADR-011): `loading`, `empty`, `error`, `not_authorized`, `read_only`, `stale_version`, `action_success`, `pending_review`.

| Plan ID | Rota | Sahip rol | Kapı |
|---|---|---|---|
| AUTH-01..05 | `auth/login`, `auth/signup`, `auth/verify-email`, `auth/forgot-password`, `auth/reset-password` | herkes | G1 |
| AUTH-06 | `auth/mfa` | oturum sahibi | G1 |
| AUTH-07 | `api/auth/*` (Better Auth, OIDC dönüşü) | — | G1 |
| AUTH-08 | `auth/invite/[token]` | davet edilen | G1 |
| AUTH-09 | `app/choose` | çok kiracılı kullanıcı | G1 |
| AUTH-12 | `app/account/security` | oturum sahibi | G1 |
| ORG-01..04 | `app/onboarding` (şirket / danışman dalı) | yeni kullanıcı | G1 |
| ORG-05, 07–09 | `app/organization`, `app/organization/entities/[id]`, `app/organization/facilities/[id]` | şirket sahibi | G2 |
| ORG-10 | `app/projects/[pid]/boundaries` | proje lideri | G2 |
| ORG-11 | `app/relationships` (izinler, iptal) | şirket sahibi | G1–G2 |
| ORG-12 | `app/settings/members` | kiracı yöneticisi | G1 |
| ORG-13 | `app/settings/audit` | kiracı yöneticisi | G1 |
| PORT-01..03 | `app/portfolio`, `app/portfolio/clients/new` | danışman | G2 / G7 |
| PORT-04..05 | `app/engagements/[id]` | danışman / şirket | G2 |
| PORT-06..13 | `app/projects`, `app/projects/new`, `app/projects/[pid]` (sekmeler: genel, plan, kapsam, standartlar, katılımcılar, etkinlik) | proje lideri | G2 |
| DATA-01..03 | `app/projects/[pid]/data` (veri planı, kampanyalar) | veri lideri | G3 |
| DATA-04..05 | `app/tasks`, `app/tasks/[id]` (4 adımlı katılımcı formu) | katılımcı | G3 |
| DATA-06..08 | `app/projects/[pid]/imports`, `app/imports/[id]` | veri lideri | G3 |
| DATA-09..10 | `app/observations/[id]`, `app/projects/[pid]/evidence` | veri sahibi | G3 |
| DATA-11..18 | `app/projects/[pid]/calculations` (sera gazı, çevre, işgücü, finans, SKDM, TR ETS, hedefler) | analist | G4 |
| DATA-19 | `app/factors` | analist | G4 |
| DATA-20 | `app/facts/[id]/lineage` | herkes (yetkiye göre) | G4 |
| CTRL-01..03 | `app/projects/[pid]/disclosures` (önemlilik, risk, açıklama panosu) | uzman | G4 / G6 |
| CTRL-04..05 | `app/projects/[pid]/quality`, `app/projects/[pid]/reconciliation` | kontrol uzmanı | G5 |
| CTRL-06..07 | `app/review`, `app/review/[id]` | gözden geçiren | G5 |
| CTRL-08..09 | `app/projects/[pid]/consolidation`, `app/projects/[pid]/close` | raporlama lideri | G5 |
| CTRL-10..11 | `app/projects/[pid]/assurance` | şirket / dış incelemeci | G7 |
| REP-01..12 | `app/projects/[pid]/reports`, `app/reports/[rid]` (sekmeler: taslak planı, yazım, şekiller, onay, önizleme, çıktılar, tasarım devri, provalar, yayın, revizyon) | editör / yönetim | G6 |
| SET-01..10 | `app/settings/*` | ilgili rol | G1 / G8 |

**v1 araç seti** mevcut rotalarında çalışmaya devam eder (ADR-008). Platform projesindeki hesap ekranları aynı motorları sunucu bağlamında çağırır.
