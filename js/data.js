// GENERATED from fixtures/*.json by tools/gen-data.js — do not hand-edit numbers here.
// Regenerate whenever fixtures change: node tools/gen-data.js. Every dashboard number must derive from this.
window.CBP_DATA = {
  "TODAY": "2026-08-28",
  "budget_year": 2026,
  "countries": [
    {
      "code": "BGD",
      "name": "Bangladesh",
      "ceiling": 1000000
    },
    {
      "code": "NPL",
      "name": "Nepal",
      "ceiling": 1000000
    },
    {
      "code": "KHM",
      "name": "Cambodia",
      "ceiling": 1000000
    },
    {
      "code": "IND",
      "name": "India",
      "ceiling": 1000000
    },
    {
      "code": "MMR",
      "name": "Myanmar",
      "ceiling": 1000000
    },
    {
      "code": "LAO",
      "name": "Lao PDR",
      "ceiling": 1000000
    },
    {
      "code": "HKG",
      "name": "Hong Kong",
      "ceiling": 1000000
    }
  ],
  "projects": [
    {
      "id": "WE26BGD0002",
      "name": "CARE \u2014 WASH & Nutrition",
      "country": "BGD",
      "status": 3,
      "amount": 760801,
      "owner": "anik",
      "backup": "priya",
      "primary_implementer": "CARE",
      "strategic_priority": "Water & Sanitation",
      "target_date": "2026-06-30",
      "submitted_at": "2026-01-30",
      "gate": {
        "decision_point": {
          "submitted_at": "2026-02-12",
          "approved_at": "2026-02-26"
        },
        "chas": {
          "submitted_at": "2026-02-12",
          "approved_at": null,
          "remark": "resubmitted docs 14 Jul"
        }
      },
      "d_in_q_start": "2026-01-30",
      "chas_guid": "179b35dc-66ed-4c55-a0a6-4e815a72c810"
    },
    {
      "id": "WE26BGD0003",
      "name": "WFP \u2014 School Feeding",
      "country": "BGD",
      "status": 4,
      "amount": 300000,
      "owner": "anik",
      "primary_implementer": "WFP",
      "target_date": "2026-09-15",
      "chas_guid": "c9a95c3e-4511-4a90-aa74-3f3426daa5cd"
    },
    {
      "id": "WE26BGD0005",
      "name": "Emergency Shelter Kits",
      "country": "BGD",
      "status": 4,
      "amount": 250000,
      "owner": "daniel",
      "primary_implementer": "Local partner",
      "target_date": "2026-08-31",
      "demo_role": "THE walk project \u2014 M2 submits, M1 approves through the full gate in the demo script",
      "chas_guid": "27eccdfa-8fa2-451e-afa1-65107a69a69a"
    },
    {
      "id": "WE25NPL0007",
      "name": "Community Water Systems",
      "country": "NPL",
      "status": 1,
      "amount": 292000,
      "owner": "sunita",
      "primary_implementer": "Local partner",
      "implementation_date": "2026-03-01",
      "phases": [
        {
          "phase": "Procurement",
          "start": "2026-03-01",
          "end": "2026-04-15"
        },
        {
          "phase": "Construction",
          "start": "2026-04-16",
          "end": "2026-09-30"
        },
        {
          "phase": "Handover",
          "start": "2026-10-01",
          "end": "2026-10-31"
        }
      ],
      "chas_guid": "43b18607-28df-4474-a103-4326023bdf22"
    },
    {
      "id": "WE26NPL0010",
      "name": "Days for Girls",
      "country": "NPL",
      "status": 3,
      "amount": 188400,
      "owner": "sunita",
      "primary_implementer": "Days for Girls Intl",
      "target_date": "2026-08-14",
      "submitted_at": "2026-07-28",
      "past_target": true,
      "chas_guid": "77374a34-3a17-4ec3-adb0-e43b4882b7c6"
    },
    {
      "id": "WE26NPL0011",
      "name": "Winterisation Support",
      "country": "NPL",
      "status": 4,
      "amount": 400000,
      "owner": "sunita",
      "target_date": "2026-10-30",
      "chas_guid": "6e5d00ca-2cb3-4638-ad40-7823d04d5d72"
    },
    {
      "id": "WE26KHM0003",
      "name": "Vision Screening Programme",
      "country": "KHM",
      "status": 2,
      "amount": 612000,
      "owner": "chan",
      "primary_implementer": "Local partner",
      "approved_at": "2026-08-19",
      "refs": {
        "decision_point": "DP-2026-0455",
        "chas": "CHS-77812"
      },
      "chas_guid": "65b6666b-e8f8-45f5-a65c-0f340451b52c"
    },
    {
      "id": "WE26IND0006",
      "name": "Mobility Devices",
      "country": "IND",
      "status": 1,
      "amount": 94200,
      "owner": "ravi",
      "implementation_date": "2026-07-01",
      "chas_guid": "165f175e-e782-4598-a75c-e238b37eb7ae"
    },
    {
      "id": "WE26IND0008",
      "name": "Maternal Health Training",
      "country": "IND",
      "status": 2,
      "amount": 260000,
      "owner": "ravi",
      "approved_at": "2026-08-26",
      "refs": {
        "decision_point": "DP-2026-0489",
        "chas": "CHS-78003"
      },
      "chas_guid": "6bbe12a7-48c2-4b4f-a8b1-1127a4c1f215"
    },
    {
      "id": "WE26MMR0004",
      "name": "Food Security Baskets",
      "country": "MMR",
      "status": 1,
      "amount": 505000,
      "owner": null,
      "implementation_date": "2026-05-01",
      "unassigned": true,
      "chas_guid": "6257b1c7-f0cc-40b6-ae4b-ea78db5fcca4"
    },
    {
      "id": "WE26MMR0009",
      "name": "Clinic Rehabilitation",
      "country": "MMR",
      "status": 3,
      "amount": 122000,
      "owner": null,
      "submitted_at": "2026-08-16",
      "unassigned": true,
      "chas_guid": "8006a45b-28d4-4a0c-aa1c-904c505a7c12"
    },
    {
      "id": "WE26LAO0002",
      "name": "School WASH Blocks",
      "country": "LAO",
      "status": 4,
      "amount": 188000,
      "owner": null,
      "target_date": "2026-11-30",
      "unassigned": true,
      "chas_guid": "2ec28996-79d0-4e99-ae0a-78d0bf1799dc"
    },
    {
      "id": "WE26HKG0001",
      "name": "Crossroads Foundation \u2014 Goods redistribution hub",
      "country": "HKG",
      "status": 1,
      "amount": 420000,
      "owner": "wing",
      "backup": "daniel",
      "primary_implementer": "Crossroads Foundation",
      "strategic_priority": "Food Security",
      "implementation_date": "2026-04-01",
      "target_date": "2026-11-30",
      "approved_at": "2026-03-20",
      "refs": {
        "decision_point": "DP-2026-0198",
        "chas": "CHS-76540"
      },
      "gate": {
        "decision_point": {
          "submitted_at": "2026-02-18",
          "approved_at": "2026-03-05"
        },
        "chas": {
          "submitted_at": "2026-02-18",
          "approved_at": "2026-03-12"
        }
      },
      "phases": [
        {
          "phase": "Setup",
          "start": "2026-04-01",
          "end": "2026-05-31"
        },
        {
          "phase": "Distribution rounds",
          "start": "2026-06-01",
          "end": "2026-09-15"
        },
        {
          "phase": "Wrap-up",
          "start": "2026-09-16",
          "end": "2026-11-30"
        }
      ],
      "d_in_q_start": "2026-02-10",
      "chas_guid": "6960d120-fd4b-4e24-aa96-2f2240e0c8f3"
    },
    {
      "id": "WE26HKG0002",
      "name": "Food Angel \u2014 Community kitchen expansion",
      "country": "HKG",
      "status": 3,
      "amount": 310000,
      "owner": "wing",
      "backup": "daniel",
      "primary_implementer": "Food Angel",
      "strategic_priority": "Food Security",
      "submitted_at": "2026-08-20",
      "gate": {
        "decision_point": {
          "submitted_at": "2026-08-24",
          "approved_at": null
        }
      },
      "d_in_q_start": "2026-08-20",
      "chas_guid": "5ee6d1a4-b791-4f22-ad4e-b990c1f80915"
    },
    {
      "id": "WE26HKG0003",
      "name": "Elderly home retrofit \u2014 Kowloon",
      "country": "HKG",
      "status": 4,
      "amount": 150000,
      "owner": "wing",
      "primary_implementer": "St. James Settlement",
      "strategic_priority": "Aging & Care",
      "target_date": "2027-03-31",
      "chas_guid": "c1564979-019c-4174-aeb8-05228ec0d9ca"
    },
    {
      "id": "WE26HKG0004",
      "name": "Typhoon readiness kits",
      "country": "HKG",
      "status": 2,
      "amount": 95000,
      "owner": "wing",
      "primary_implementer": "HKRC",
      "strategic_priority": "Emergency Response",
      "submitted_at": "2026-07-28",
      "approved_at": "2026-08-10",
      "refs": {
        "decision_point": "DP-2026-0431",
        "chas": "CHS-77690"
      },
      "gate": {
        "decision_point": {
          "submitted_at": "2026-07-30",
          "approved_at": "2026-08-08"
        },
        "chas": {
          "submitted_at": "2026-07-30",
          "approved_at": "2026-08-08"
        }
      },
      "d_in_q_start": "2026-07-28",
      "chas_guid": "e00a580d-6c3a-4f77-a409-2780ee1c2eed"
    }
  ],
  "reconciliation": {
    "BGD": 1310801,
    "NPL": 880400,
    "KHM": 612000,
    "IND": 354200,
    "MMR": 627000,
    "LAO": 188000,
    "HKG": 975000,
    "note": "Committed per country = sum(amount) all statuses. Dashboard must derive, not hard-code. 3 unassigned projects drive the attention row."
  },
  "users": [
    {
      "id": "admin",
      "name": "Area Office Admin",
      "role": "admin",
      "country_scope": "all"
    },
    {
      "id": "priya",
      "name": "Priya N.",
      "role": "m1",
      "title": "Regional Manager \u00b7 South Asia",
      "country_scope": [
        "BGD",
        "NPL",
        "IND"
      ]
    },
    {
      "id": "marco",
      "name": "Marco T.",
      "role": "m1",
      "title": "Regional Manager \u00b7 Mekong",
      "country_scope": [
        "KHM",
        "MMR",
        "LAO"
      ]
    },
    {
      "id": "daniel",
      "name": "Daniel K.",
      "role": "m2",
      "title": "Area Manager",
      "country_scope": "all"
    },
    {
      "id": "anik",
      "name": "Anik R.",
      "role": "m3",
      "country_scope": [
        "BGD"
      ]
    },
    {
      "id": "sunita",
      "name": "Sunita M.",
      "role": "m3",
      "country_scope": [
        "NPL"
      ]
    },
    {
      "id": "santoso",
      "name": "Bp. Santoso",
      "role": "viewer",
      "view_scope": [
        "BGD",
        "NPL"
      ],
      "read_only": true,
      "note": "RD-3 print export allowed; every action control hidden"
    },
    {
      "id": "elena",
      "name": "Elena V.",
      "role": "ogc",
      "title": "Office of General Counsel \u00b7 Asia Area",
      "country_scope": "all",
      "note": "Contract reviewer (OGC). No project actions."
    },
    {
      "id": "rafael",
      "name": "Rafael T.",
      "role": "finance",
      "title": "Area Finance Reviewer",
      "country_scope": "all",
      "note": "Contract reviewer (Finance). No project actions."
    }
  ],
  "persona_switcher_order": [
    "anik",
    "daniel",
    "priya",
    "santoso",
    "elena"
  ],
  "delegations": [
    {
      "away": "marco",
      "delegate": "priya",
      "from": "2026-08-24",
      "to": "2026-09-05",
      "reason": "Annual leave"
    }
  ],
  "seed_attention": [
    {
      "rule": "gate-idle",
      "project": "WE26BGD0002",
      "system": "chas",
      "days": 197,
      "severity": "rose",
      "text": "CHaS gate \u2014 submitted 12 Feb, no approval yet"
    },
    {
      "rule": "over-ceiling",
      "country": "BGD",
      "amount_over": 310801,
      "coverage": 131,
      "severity": "rose",
      "text": "$310,801 above the 2026 allocation"
    },
    {
      "rule": "target-passed",
      "project": "WE26NPL0010",
      "days": 14,
      "severity": "brass",
      "text": "Target date passed, still in status 3 review"
    },
    {
      "rule": "unassigned",
      "count": 3,
      "projects": [
        "WE26MMR0004",
        "WE26MMR0009",
        "WE26LAO0002"
      ],
      "severity": "neutral",
      "text": "No owner set \u2014 alerts cannot route"
    }
  ],
  "activity_seed": [
    {
      "id": "L1",
      "project": "WE26BGD0002",
      "type": "system",
      "body": "Status changed 4 \u2192 3 (Request submitted)",
      "author": "daniel",
      "at": "2026-01-30"
    },
    {
      "id": "L2",
      "project": "WE26BGD0002",
      "type": "system",
      "body": "Decision Point \u2014 request approved",
      "author": "priya",
      "at": "2026-02-26"
    },
    {
      "id": "L3",
      "project": "WE26BGD0002",
      "type": "note",
      "body": "CHaS office asked for revised partner budget breakdown before they will progress the record.",
      "author": "priya",
      "at": "2026-07-10"
    },
    {
      "id": "L4",
      "project": "WE26BGD0002",
      "type": "note",
      "body": "Resubmitted full docs pack to CHaS on 14 Jul \u2014 remark recorded on the gate.",
      "author": "anik",
      "at": "2026-07-14",
      "parent": "L3"
    },
    {
      "id": "L5",
      "project": "WE26BGD0002",
      "type": "question",
      "body": "Do we split WASH and Nutrition into separate CHaS records if the gate stays idle past September?",
      "author": "daniel",
      "at": "2026-08-20",
      "assigned_to": "priya",
      "resolved_at": null
    },
    {
      "id": "L6",
      "project": "WE26BGD0002",
      "type": "decision",
      "body": "Keep as one combined record; escalate through the Area office if no CHaS response by 30 Sep.",
      "author": "priya",
      "at": "2026-08-25",
      "pinned": true
    },
    {
      "id": "L7",
      "project": "WE26BGD0005",
      "type": "note",
      "body": "Kit specification finalised with the local partner; unit cost $50 within plan.",
      "author": "daniel",
      "at": "2026-08-21"
    },
    {
      "id": "L8",
      "project": "WE26BGD0005",
      "type": "question",
      "body": "Confirm warehouse handling fees are inside the $250,000 envelope?",
      "author": "priya",
      "at": "2026-08-24",
      "assigned_to": "daniel",
      "resolved_at": "2026-08-26"
    },
    {
      "id": "L9",
      "project": "WE25NPL0007",
      "type": "system",
      "body": "Status changed 2 \u2192 1 (implementation started)",
      "author": "priya",
      "at": "2026-03-01"
    },
    {
      "id": "L10",
      "project": "WE25NPL0007",
      "type": "decision",
      "body": "Handover ceremony aligned to district schedule \u2014 31 Oct target confirmed.",
      "author": "sunita",
      "at": "2026-08-05",
      "pinned": true
    },
    {
      "id": "L11",
      "project": "WE26NPL0010",
      "type": "question",
      "body": "Target date has passed while in review \u2014 extend target or expedite?",
      "author": "sunita",
      "at": "2026-08-18",
      "assigned_to": "priya",
      "resolved_at": null
    },
    {
      "id": "L12",
      "project": "WE26MMR0009",
      "type": "note",
      "body": "Submitted without an owner \u2014 needs assignment before review can route alerts.",
      "author": "daniel",
      "at": "2026-08-17"
    },
    {
      "id": "L13",
      "project": "WE26HKG0002",
      "type": "system",
      "body": "Status changed 4 \u2192 3 (Request submitted)",
      "author": "wing",
      "at": "2026-08-20"
    },
    {
      "id": "L14",
      "project": "WE26HKG0001",
      "type": "note",
      "body": "Distribution rounds are on track to close on 15 Sep; wrap-up paperwork starts the day after.",
      "author": "wing",
      "at": "2026-08-25"
    }
  ],
  "comments_seed": [
    {
      "id": "C1",
      "project_id": "WE26BGD0002",
      "author": "anik",
      "at": "2026-08-18",
      "time": "14:05",
      "body": "CHaS still has not moved on this. I have chased the office twice since the 14 Jul resubmission \u2014 do we escalate through the Area office?",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C2",
      "project_id": "WE26BGD0002",
      "author": "priya",
      "at": "2026-08-19",
      "time": "09:20",
      "body": "Escalating is the right call if nothing lands by 30 Sep. Keep the partner budget breakdown attached so we are not asked for it a third time.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C3",
      "project_id": "WE26BGD0002",
      "author": "priya",
      "at": "2026-08-20",
      "time": "11:40",
      "body": "Decision Point cleared on 26 Feb. I am holding the 3 \u2014 2 move until CHaS records its approval: the reference number has to exist before I can mark this approved.",
      "kind": "approval_note",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C4",
      "project_id": "WE26BGD0002",
      "author": "anik",
      "at": "2026-08-21",
      "time": "16:15",
      "body": "Understood. The full docs pack went back to CHaS on 14 Jul and the remark is on the gate. I will post here the moment they issue a reference.",
      "kind": "approval_note",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C5",
      "project_id": "WE26BGD0005",
      "author": "daniel",
      "at": "2026-08-22",
      "time": "10:05",
      "body": "Kit specification is signed off with the local partner. Unit cost holds at $50, so the $250,000 envelope still stands.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C6",
      "project_id": "WE26BGD0005",
      "author": "daniel",
      "at": "2026-08-24",
      "time": "15:30",
      "body": "Submitting for review. Warehouse handling sits inside the envelope and the partner agreement is attached to the record.",
      "kind": "approval_note",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C7",
      "project_id": "WE26BGD0005",
      "author": "priya",
      "at": "2026-08-25",
      "time": "09:45",
      "body": "Reviewed. One thing before I approve it to the gate: confirm the handling fee line is the partner\u2019s own and not a second charge from the freight agent.",
      "kind": "approval_note",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C8",
      "project_id": "WE26BGD0003",
      "author": "anik",
      "at": "2026-08-26",
      "time": "13:10",
      "body": "WFP have asked whether the school feeding window can start a month earlier. That pulls the target date to 15 Aug \u2014 flagging it before we submit.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C9",
      "project_id": "WE25NPL0007",
      "author": "sunita",
      "at": "2026-08-17",
      "time": "08:50",
      "body": "Construction is on schedule for the 30 Sep finish. The handover ceremony is booked with the district for 31 Oct.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C10",
      "project_id": "WE26NPL0010",
      "author": "sunita",
      "at": "2026-08-23",
      "time": "12:25",
      "body": "The target date passed on 14 Aug while we are still in review. Either we extend the target or this needs expediting \u2014 I cannot hold the supplier price much longer.",
      "kind": "comment",
      "edited_at": null,
      "priority": true
    },
    {
      "id": "C11",
      "project_id": "WE26NPL0010",
      "author": "priya",
      "at": "2026-08-27",
      "time": "10:15",
      "body": "Extending the target to 30 Sep. Nothing about the request itself has changed, so it does not need to go back to development.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C12",
      "project_id": "WE26KHM0003",
      "author": "marco",
      "at": "2026-08-20",
      "time": "11:05",
      "body": "Approved on 19 Aug with both references recorded. Screening starts once the clinic rota is confirmed and no budget change is expected.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C13",
      "project_id": "WE26IND0008",
      "author": "ravi",
      "at": "2026-08-27",
      "time": "14:40",
      "body": "Approved on 26 Aug. The first training cohort is set for October; I will load the phase dates once the venue is confirmed.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C14",
      "project_id": "WE26MMR0009",
      "author": "daniel",
      "at": "2026-08-21",
      "time": "09:35",
      "body": "This one is still sitting without an owner, so no alert can route. I will assign it as soon as the Myanmar team confirm who is picking it up.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C15",
      "project_id": "WE26HKG0002",
      "author": "wing",
      "at": "2026-08-21",
      "time": "10:05",
      "body": "Kitchen No.4 lease signed \u2014 cost sheet attached to the request.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C16",
      "project_id": "WE26HKG0002",
      "author": "daniel",
      "at": "2026-08-22",
      "time": "09:40",
      "body": "Submitting this one for review. The lease and the partner\u2019s cost sheet are both on the record, so there is nothing outstanding from our side. Could M1 prioritise it? The fit-out has to finish before the winter meal programme opens.",
      "kind": "approval_note",
      "edited_at": null,
      "priority": false
    },
    {
      "id": "C17",
      "project_id": "WE26HKG0001",
      "author": "wing",
      "at": "2026-08-25",
      "time": "16:12",
      "body": "Distribution round 3 closed ahead of plan \u2014 41 tonnes moved through the hub this month. The rounds still finish on 15 Sep and wrap-up is unchanged.",
      "kind": "comment",
      "edited_at": null,
      "priority": false
    }
  ],
  "budget_history": [
    {
      "code": "BGD",
      "years": {
        "2024": {
          "ceiling": 1000000,
          "committed": 940000,
          "spent_q": [
            180000,
            245000,
            260000,
            232000
          ]
        },
        "2025": {
          "ceiling": 1000000,
          "committed": 1080000,
          "spent_q": [
            215000,
            285000,
            300000,
            268000
          ]
        }
      },
      "plan_2027": 1100000
    },
    {
      "code": "NPL",
      "years": {
        "2024": {
          "ceiling": 1000000,
          "committed": 760000,
          "spent_q": [
            150000,
            190000,
            205000,
            198000
          ]
        },
        "2025": {
          "ceiling": 1000000,
          "committed": 845000,
          "spent_q": [
            170000,
            215000,
            230000,
            218000
          ]
        }
      },
      "plan_2027": 920000
    },
    {
      "code": "KHM",
      "years": {
        "2024": {
          "ceiling": 1000000,
          "committed": 540000,
          "spent_q": [
            105000,
            135000,
            145000,
            142000
          ]
        },
        "2025": {
          "ceiling": 1000000,
          "committed": 588000,
          "spent_q": [
            118000,
            148000,
            158000,
            152000
          ]
        }
      },
      "plan_2027": 650000
    },
    {
      "code": "IND",
      "years": {
        "2024": {
          "ceiling": 1000000,
          "committed": 415000,
          "spent_q": [
            82000,
            104000,
            112000,
            109000
          ]
        },
        "2025": {
          "ceiling": 1000000,
          "committed": 372000,
          "spent_q": [
            74000,
            93000,
            100000,
            98000
          ]
        }
      },
      "plan_2027": 400000
    },
    {
      "code": "MMR",
      "years": {
        "2024": {
          "ceiling": 1000000,
          "committed": 690000,
          "spent_q": [
            128000,
            172000,
            186000,
            190000
          ]
        },
        "2025": {
          "ceiling": 1000000,
          "committed": 605000,
          "spent_q": [
            115000,
            152000,
            164000,
            162000
          ]
        }
      },
      "plan_2027": 640000
    },
    {
      "code": "LAO",
      "years": {
        "2024": {
          "ceiling": 1000000,
          "committed": 210000,
          "spent_q": [
            38000,
            52000,
            56000,
            58000
          ]
        },
        "2025": {
          "ceiling": 1000000,
          "committed": 165000,
          "spent_q": [
            30000,
            41000,
            45000,
            44000
          ]
        }
      },
      "plan_2027": 240000
    },
    {
      "code": "HKG",
      "years": {
        "2024": {
          "ceiling": 1000000,
          "committed": 580000,
          "spent_q": [
            112000,
            145000,
            158000,
            152000
          ]
        },
        "2025": {
          "ceiling": 1000000,
          "committed": 660000,
          "spent_q": [
            128000,
            165000,
            180000,
            172000
          ]
        }
      },
      "plan_2027": 900000
    }
  ],
  "integrations": {
    "chas": {
      "label": "CHaS \u00b7 Dynamics 365",
      "kind": "gate",
      "driver": "sim",
      "mode": "manual",
      "authoritative": true,
      "health": "ok",
      "last_sync_at": "2026-08-27",
      "endpoint_masked": "https://chas.crm.dynamics.com/api/data/v9.2/\u2026",
      "secret_set": false,
      "deep_link_template": "https://chas.crm.dynamics.com/main.aspx?appid=d7cf45b9-1d62-ea11-a811-000d3a579cbe&pagetype=entityrecord&etn=chas_humanitarianproject&id={chas_guid}",
      "mapping": [
        {
          "portal_field": "id",
          "ext_field": "chas_projectid (Project ID)",
          "direction": "key",
          "note": "WE26BGD0004 pattern"
        },
        {
          "portal_field": "chas_guid",
          "ext_field": "chas_humanitarianprojectid",
          "direction": "key",
          "note": "record GUID for deep link"
        },
        {
          "portal_field": "gate.chas.submitted_at",
          "ext_field": "createdon / statuscode=Submitted",
          "direction": "write",
          "note": "portal lodges"
        },
        {
          "portal_field": "gate.chas.approved_at",
          "ext_field": "statuscode=Approved \u00b7 modifiedon",
          "direction": "read",
          "note": "CHaS is authoritative"
        },
        {
          "portal_field": "refs.chas",
          "ext_field": "chas_projectid",
          "direction": "read",
          "note": ""
        },
        {
          "portal_field": "status",
          "ext_field": "statuscode",
          "direction": "write",
          "note": "Active / Implementation mirror"
        },
        {
          "portal_field": "primary_contract_id",
          "ext_field": "chas_contractref (custom)",
          "direction": "write",
          "note": "S-11 contract_sent"
        }
      ],
      "stats": {
        "ok": 0,
        "failed": 0,
        "proposals": 0
      }
    },
    "decision_point": {
      "label": "Decision Point",
      "kind": "gate",
      "driver": "deeplink",
      "mode": "manual",
      "authoritative": true,
      "health": "off",
      "last_sync_at": null,
      "endpoint_masked": "",
      "secret_set": false,
      "deep_link_template": "https://decisionpoint.example.org/requests/{decision_point_ref}",
      "mapping": [
        {
          "portal_field": "refs.decision_point",
          "ext_field": "Request No.",
          "direction": "key",
          "note": "typed by M1 at Mark Approved"
        },
        {
          "portal_field": "gate.decision_point.submitted_at",
          "ext_field": "Submitted",
          "direction": "write",
          "note": ""
        },
        {
          "portal_field": "gate.decision_point.approved_at",
          "ext_field": "Decision date",
          "direction": "read",
          "note": "Decision Point is authoritative"
        }
      ],
      "stats": {
        "ok": 0,
        "failed": 0,
        "proposals": 0
      }
    },
    "smtp": {
      "label": "SMTP \u00b7 outbound mail",
      "kind": "service",
      "driver": "sim",
      "mode": "auto",
      "health": "ok",
      "last_sync_at": "2026-08-28",
      "note": "Simulated: every send lands in the P8 outbox."
    },
    "timeblock": {
      "label": "TimeBlock \u00b7 Gantt",
      "kind": "service",
      "driver": "sim",
      "mode": "auto",
      "health": "ok",
      "last_sync_at": "2026-08-28",
      "note": "Simulated: P5 timeline reads project phases directly."
    }
  },
  "gate_events_seed": [
    {
      "id": "GE001",
      "project_id": "WE26BGD0002",
      "system": "decision_point",
      "step": "submitted",
      "at": "2026-02-12",
      "actor": "priya",
      "source": "manual",
      "confidence": "authoritative",
      "ref": null,
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE002",
      "project_id": "WE26BGD0002",
      "system": "decision_point",
      "step": "approved",
      "at": "2026-02-26",
      "actor": "priya",
      "source": "manual",
      "confidence": "authoritative",
      "ref": null,
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE003",
      "project_id": "WE26BGD0002",
      "system": "chas",
      "step": "submitted",
      "at": "2026-02-12",
      "actor": "priya",
      "source": "manual",
      "confidence": "authoritative",
      "ref": null,
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE004",
      "project_id": "WE26HKG0001",
      "system": "decision_point",
      "step": "submitted",
      "at": "2026-02-18",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": "DP-2026-0198",
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE005",
      "project_id": "WE26HKG0001",
      "system": "decision_point",
      "step": "approved",
      "at": "2026-03-05",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": "DP-2026-0198",
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE006",
      "project_id": "WE26HKG0001",
      "system": "chas",
      "step": "submitted",
      "at": "2026-02-18",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": "CHS-76540",
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE007",
      "project_id": "WE26HKG0001",
      "system": "chas",
      "step": "approved",
      "at": "2026-03-12",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": "CHS-76540",
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE008",
      "project_id": "WE26HKG0002",
      "system": "decision_point",
      "step": "submitted",
      "at": "2026-08-24",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": null,
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE009",
      "project_id": "WE26HKG0004",
      "system": "decision_point",
      "step": "submitted",
      "at": "2026-07-30",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": "DP-2026-0431",
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE010",
      "project_id": "WE26HKG0004",
      "system": "decision_point",
      "step": "approved",
      "at": "2026-08-08",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": "DP-2026-0431",
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE011",
      "project_id": "WE26HKG0004",
      "system": "chas",
      "step": "submitted",
      "at": "2026-07-30",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": "CHS-77690",
      "note": "backfilled from v1.0.4 gate dates"
    },
    {
      "id": "GE012",
      "project_id": "WE26HKG0004",
      "system": "chas",
      "step": "approved",
      "at": "2026-08-08",
      "actor": "admin",
      "source": "manual",
      "confidence": "authoritative",
      "ref": "CHS-77690",
      "note": "backfilled from v1.0.4 gate dates"
    }
  ],
  "contract_templates": [
    {
      "id": "T-UN",
      "name": "Corporate Agreement \u00b7 UN agency",
      "partner_type_scope": [
        "un"
      ],
      "country_scope": "all",
      "version": "2026.2",
      "status": "active",
      "tokens": [
        "{project_id}",
        "{project_name}",
        "{partner}",
        "{country}",
        "{amount_usd}",
        "{decision_point_ref}",
        "{chas_ref}",
        "{start_date}",
        "{end_date}"
      ],
      "clauses": [
        "Purpose",
        "Scope of work",
        "Funding and disbursement",
        "Reporting",
        "Branding and communication",
        "Data protection",
        "Anti-fraud and safeguarding",
        "Term and termination",
        "Signatures"
      ]
    },
    {
      "id": "T-INGO",
      "name": "Corporate Agreement \u00b7 International NGO",
      "partner_type_scope": [
        "ingo"
      ],
      "country_scope": "all",
      "version": "2026.2",
      "status": "active",
      "tokens": [
        "{project_id}",
        "{project_name}",
        "{partner}",
        "{country}",
        "{amount_usd}",
        "{decision_point_ref}",
        "{chas_ref}",
        "{start_date}",
        "{end_date}"
      ],
      "clauses": [
        "Purpose",
        "Scope of work",
        "Funding and disbursement",
        "Procurement",
        "Reporting",
        "Monitoring and evaluation",
        "Safeguarding",
        "Anti-fraud",
        "Term and termination",
        "Signatures"
      ]
    },
    {
      "id": "T-LOCAL",
      "name": "Corporate Agreement \u00b7 Local partner",
      "partner_type_scope": [
        "local"
      ],
      "country_scope": "all",
      "version": "2026.1",
      "status": "active",
      "tokens": [
        "{project_id}",
        "{project_name}",
        "{partner}",
        "{country}",
        "{amount_usd}",
        "{decision_point_ref}",
        "{chas_ref}",
        "{start_date}",
        "{end_date}"
      ],
      "clauses": [
        "Purpose",
        "Scope of work",
        "Funding and disbursement (tranches)",
        "Procurement",
        "Reporting",
        "Monitoring and evaluation",
        "Safeguarding",
        "Anti-fraud",
        "Local law compliance",
        "Term and termination",
        "Signatures"
      ]
    },
    {
      "id": "T-AMEND",
      "name": "Amendment to Corporate Agreement",
      "partner_type_scope": [
        "un",
        "ingo",
        "local"
      ],
      "country_scope": "all",
      "version": "2026.1",
      "status": "active",
      "tokens": [
        "{parent_contract_id}",
        "{amendment_no}",
        "{project_id}",
        "{partner}",
        "{change_summary}",
        "{amount_usd}"
      ],
      "clauses": [
        "Reference to original agreement",
        "Amended terms",
        "Effect on budget",
        "Signatures"
      ]
    }
  ],
  "signing_authority": [
    {
      "user_id": "admin",
      "role": "admin",
      "country_scope": "all",
      "min_usd": 0,
      "max_usd": null,
      "types": [
        "un",
        "ingo",
        "local",
        "amend"
      ]
    },
    {
      "user_id": "daniel",
      "role": "m2",
      "country_scope": "all",
      "min_usd": 0,
      "max_usd": 1000000,
      "types": [
        "un",
        "ingo",
        "local",
        "amend"
      ]
    },
    {
      "user_id": "priya",
      "role": "m1",
      "country_scope": [
        "BGD",
        "NPL",
        "IND"
      ],
      "min_usd": 0,
      "max_usd": 500000,
      "types": [
        "un",
        "ingo",
        "local",
        "amend"
      ]
    },
    {
      "user_id": "marco",
      "role": "m1",
      "country_scope": [
        "KHM",
        "MMR",
        "LAO"
      ],
      "min_usd": 0,
      "max_usd": 500000,
      "types": [
        "un",
        "ingo",
        "local",
        "amend"
      ]
    }
  ],
  "signing_delegations": [],
  "contracts": [
    {
      "id": "AS-0137",
      "project_id": "WE26HKG0001",
      "partner": "Hong Kong Red Cross",
      "partner_type": "local",
      "country": "HKG",
      "amount": 420000,
      "currency": "USD",
      "amount_usd": 420000,
      "status": "active",
      "template_id": "T-LOCAL",
      "version_no": 2,
      "versions": [
        {
          "no": 1,
          "at": "2026-03-02",
          "author": "daniel",
          "summary": "Initial draft from T-LOCAL"
        },
        {
          "no": 2,
          "at": "2026-03-09",
          "author": "daniel",
          "summary": "Finance: tranche schedule aligned to phases"
        }
      ],
      "reviews": [
        {
          "division": "ogc",
          "order_index": 1,
          "assignee": "elena",
          "status": "approved",
          "due_at": "2026-03-07",
          "decided_at": "2026-03-06",
          "comment": "Standard terms"
        },
        {
          "division": "finance",
          "order_index": 1,
          "assignee": "rafael",
          "status": "approved",
          "due_at": "2026-03-07",
          "decided_at": "2026-03-09",
          "comment": "Tranches revised"
        }
      ],
      "signatories": [
        {
          "order_index": 1,
          "party": "church",
          "user_id": "daniel",
          "name": null,
          "title": "Area Manager",
          "method": "click",
          "status": "signed",
          "signed_at": "2026-03-12",
          "authority_ok": true
        },
        {
          "order_index": 2,
          "party": "partner",
          "user_id": null,
          "name": "Ms. Carol Lam",
          "title": "Secretary General, HKRC",
          "method": "wet_ink",
          "status": "signed",
          "signed_at": "2026-03-16",
          "authority_ok": true
        }
      ],
      "attestations": {
        "supplements_local": true,
        "no_dependency": true,
        "not_primary_support": true,
        "partner_verified": true
      },
      "screening": {
        "date": "2026-02-20",
        "result": "clear"
      },
      "due_diligence": "verified",
      "obligations": [
        {
          "type": "report",
          "title": "Q3 narrative + financial report",
          "due_date": "2026-10-15",
          "owner": "anik",
          "status": "open"
        }
      ],
      "sent_at": "2026-03-17",
      "executed_at": "2026-03-16",
      "parent_contract_id": null,
      "amendment_no": 0,
      "log_ids": []
    },
    {
      "id": "AS-0138",
      "project_id": "WE25NPL0007",
      "partner": "People's Development Foundation",
      "partner_type": "local",
      "country": "NPL",
      "amount": 292000,
      "currency": "USD",
      "amount_usd": 292000,
      "status": "active",
      "template_id": "T-LOCAL",
      "version_no": 1,
      "versions": [
        {
          "no": 1,
          "at": "2025-11-04",
          "author": "daniel",
          "summary": "Initial draft from T-LOCAL"
        }
      ],
      "reviews": [
        {
          "division": "ogc",
          "order_index": 1,
          "assignee": "elena",
          "status": "approved",
          "due_at": "2025-11-10",
          "decided_at": "2025-11-08",
          "comment": ""
        },
        {
          "division": "finance",
          "order_index": 1,
          "assignee": "rafael",
          "status": "approved",
          "due_at": "2025-11-10",
          "decided_at": "2025-11-09",
          "comment": ""
        }
      ],
      "signatories": [
        {
          "order_index": 1,
          "party": "church",
          "user_id": "priya",
          "name": null,
          "title": "Regional Manager \u00b7 South Asia",
          "method": "click",
          "status": "signed",
          "signed_at": "2025-11-12",
          "authority_ok": true
        },
        {
          "order_index": 2,
          "party": "partner",
          "user_id": null,
          "name": "Mr. Ram Thapa",
          "title": "Executive Director, PDF",
          "method": "wet_ink",
          "status": "signed",
          "signed_at": "2025-11-18",
          "authority_ok": true
        }
      ],
      "attestations": {
        "supplements_local": true,
        "no_dependency": true,
        "not_primary_support": true,
        "partner_verified": true
      },
      "screening": {
        "date": "2025-10-28",
        "result": "clear"
      },
      "due_diligence": "verified",
      "obligations": [
        {
          "type": "report",
          "title": "Final report",
          "due_date": "2026-12-31",
          "owner": "sunita",
          "status": "open"
        }
      ],
      "sent_at": "2025-11-19",
      "executed_at": "2025-11-18",
      "parent_contract_id": null,
      "amendment_no": 0,
      "log_ids": []
    },
    {
      "id": "AS-0139",
      "project_id": "WE26IND0006",
      "partner": "Little Drops Old Age Home",
      "partner_type": "local",
      "country": "IND",
      "amount": 94200,
      "currency": "USD",
      "amount_usd": 94200,
      "status": "sent",
      "template_id": "T-LOCAL",
      "version_no": 1,
      "versions": [
        {
          "no": 1,
          "at": "2026-08-04",
          "author": "daniel",
          "summary": "Initial draft from T-LOCAL"
        }
      ],
      "reviews": [
        {
          "division": "ogc",
          "order_index": 1,
          "assignee": "elena",
          "status": "approved",
          "due_at": "2026-08-11",
          "decided_at": "2026-08-08",
          "comment": ""
        },
        {
          "division": "finance",
          "order_index": 1,
          "assignee": "rafael",
          "status": "approved",
          "due_at": "2026-08-11",
          "decided_at": "2026-08-10",
          "comment": ""
        }
      ],
      "signatories": [
        {
          "order_index": 1,
          "party": "church",
          "user_id": "priya",
          "name": null,
          "title": "Regional Manager \u00b7 South Asia",
          "method": "click",
          "status": "signed",
          "signed_at": "2026-08-14",
          "authority_ok": true
        },
        {
          "order_index": 2,
          "party": "partner",
          "user_id": null,
          "name": "Sr. Mary Joseph",
          "title": "Director, Little Drops",
          "method": "wet_ink",
          "status": "signed",
          "signed_at": "2026-08-22",
          "authority_ok": true
        }
      ],
      "attestations": {
        "supplements_local": true,
        "no_dependency": true,
        "not_primary_support": true,
        "partner_verified": true
      },
      "screening": {
        "date": "2026-07-30",
        "result": "clear"
      },
      "due_diligence": "verified",
      "obligations": [],
      "sent_at": "2026-08-26",
      "executed_at": "2026-08-22",
      "parent_contract_id": null,
      "amendment_no": 0,
      "log_ids": []
    },
    {
      "id": "AS-0140",
      "project_id": "WE26MMR0004",
      "partner": "Myanmar Red Cross Society",
      "partner_type": "local",
      "country": "MMR",
      "amount": 505000,
      "currency": "USD",
      "amount_usd": 505000,
      "status": "amending",
      "template_id": "T-LOCAL",
      "version_no": 1,
      "versions": [
        {
          "no": 1,
          "at": "2026-02-10",
          "author": "daniel",
          "summary": "Initial draft from T-LOCAL"
        }
      ],
      "reviews": [
        {
          "division": "ogc",
          "order_index": 1,
          "assignee": "elena",
          "status": "approved",
          "due_at": "2026-02-17",
          "decided_at": "2026-02-14",
          "comment": ""
        },
        {
          "division": "finance",
          "order_index": 1,
          "assignee": "rafael",
          "status": "approved",
          "due_at": "2026-02-17",
          "decided_at": "2026-02-16",
          "comment": ""
        }
      ],
      "signatories": [
        {
          "order_index": 1,
          "party": "church",
          "user_id": "daniel",
          "name": null,
          "title": "Area Manager",
          "method": "click",
          "status": "signed",
          "signed_at": "2026-02-20",
          "authority_ok": true
        },
        {
          "order_index": 2,
          "party": "partner",
          "user_id": null,
          "name": "Dr. Myo Nyunt",
          "title": "President, MRCS",
          "method": "wet_ink",
          "status": "signed",
          "signed_at": "2026-02-27",
          "authority_ok": true
        }
      ],
      "attestations": {
        "supplements_local": true,
        "no_dependency": true,
        "not_primary_support": true,
        "partner_verified": true
      },
      "screening": {
        "date": "2026-01-30",
        "result": "clear"
      },
      "due_diligence": "verified",
      "obligations": [
        {
          "type": "report",
          "title": "Mid-term report",
          "due_date": "2026-09-30",
          "owner": "marco",
          "status": "open"
        }
      ],
      "sent_at": "2026-03-02",
      "executed_at": "2026-02-27",
      "parent_contract_id": null,
      "amendment_no": 0,
      "log_ids": []
    },
    {
      "id": "AS-0141",
      "project_id": "WE26BGD0002",
      "partner": "CARE Bangladesh",
      "partner_type": "ingo",
      "country": "BGD",
      "amount": 760801,
      "currency": "USD",
      "amount_usd": 760801,
      "status": "draft",
      "template_id": "T-INGO",
      "version_no": 1,
      "versions": [
        {
          "no": 1,
          "at": "2026-08-20",
          "author": "daniel",
          "summary": "Early draft (gate open, CONTRACT_DRAFT_FROM=3)"
        }
      ],
      "reviews": [],
      "signatories": [
        {
          "order_index": 1,
          "party": "church",
          "user_id": "daniel",
          "name": null,
          "title": "Area Manager",
          "method": "click",
          "status": "pending",
          "signed_at": null,
          "authority_ok": true
        },
        {
          "order_index": 2,
          "party": "partner",
          "user_id": null,
          "name": "Country Director, CARE Bangladesh",
          "title": "Country Director",
          "method": "wet_ink",
          "status": "pending",
          "signed_at": null,
          "authority_ok": true
        }
      ],
      "attestations": {
        "supplements_local": true,
        "no_dependency": true,
        "not_primary_support": false,
        "partner_verified": true
      },
      "screening": {
        "date": "2026-08-18",
        "result": "clear"
      },
      "due_diligence": "pending",
      "obligations": [],
      "sent_at": null,
      "executed_at": null,
      "parent_contract_id": null,
      "amendment_no": 0,
      "log_ids": []
    },
    {
      "id": "AS-0142",
      "project_id": "WE26IND0008",
      "partner": "Christian's Burial Ground Association",
      "partner_type": "local",
      "country": "IND",
      "amount": 260000,
      "currency": "USD",
      "amount_usd": 260000,
      "status": "in_review",
      "template_id": "T-LOCAL",
      "version_no": 2,
      "versions": [
        {
          "no": 1,
          "at": "2026-08-12",
          "author": "daniel",
          "summary": "Initial draft from T-LOCAL"
        },
        {
          "no": 2,
          "at": "2026-08-19",
          "author": "daniel",
          "summary": "Procurement clause per OGC pre-read"
        }
      ],
      "reviews": [
        {
          "division": "ogc",
          "order_index": 1,
          "assignee": "elena",
          "status": "pending",
          "due_at": "2026-08-26",
          "decided_at": null,
          "comment": ""
        },
        {
          "division": "finance",
          "order_index": 1,
          "assignee": "rafael",
          "status": "approved",
          "due_at": "2026-08-26",
          "decided_at": "2026-08-24",
          "comment": "Budget matches CHaS ref"
        }
      ],
      "signatories": [
        {
          "order_index": 1,
          "party": "church",
          "user_id": "priya",
          "name": null,
          "title": "Regional Manager \u00b7 South Asia",
          "method": "click",
          "status": "pending",
          "signed_at": null,
          "authority_ok": true
        },
        {
          "order_index": 2,
          "party": "partner",
          "user_id": null,
          "name": "Rev. Samuel Prakash",
          "title": "Chairman, CBGA",
          "method": "wet_ink",
          "status": "pending",
          "signed_at": null,
          "authority_ok": true
        }
      ],
      "attestations": {
        "supplements_local": true,
        "no_dependency": true,
        "not_primary_support": true,
        "partner_verified": true
      },
      "screening": {
        "date": "2026-08-05",
        "result": "clear"
      },
      "due_diligence": "verified",
      "obligations": [],
      "sent_at": null,
      "executed_at": null,
      "parent_contract_id": null,
      "amendment_no": 0,
      "log_ids": []
    },
    {
      "id": "AS-0143",
      "project_id": "WE26KHM0003",
      "partner": "Khmer-Soviet Friendship Hospital",
      "partner_type": "local",
      "country": "KHM",
      "amount": 612000,
      "currency": "USD",
      "amount_usd": 612000,
      "status": "signing",
      "template_id": "T-LOCAL",
      "version_no": 3,
      "versions": [
        {
          "no": 1,
          "at": "2026-07-21",
          "author": "daniel",
          "summary": "Initial draft from T-LOCAL"
        },
        {
          "no": 2,
          "at": "2026-07-29",
          "author": "daniel",
          "summary": "OGC: equipment title clause"
        },
        {
          "no": 3,
          "at": "2026-08-05",
          "author": "daniel",
          "summary": "Finance: disbursement in 3 tranches"
        }
      ],
      "reviews": [
        {
          "division": "ogc",
          "order_index": 1,
          "assignee": "elena",
          "status": "approved",
          "due_at": "2026-08-01",
          "decided_at": "2026-07-31",
          "comment": ""
        },
        {
          "division": "finance",
          "order_index": 1,
          "assignee": "rafael",
          "status": "approved",
          "due_at": "2026-08-01",
          "decided_at": "2026-08-06",
          "comment": ""
        }
      ],
      "signatories": [
        {
          "order_index": 1,
          "party": "church",
          "user_id": "marco",
          "name": null,
          "title": "Regional Manager \u00b7 Mekong",
          "method": "click",
          "status": "signed",
          "signed_at": "2026-08-19",
          "authority_ok": true
        },
        {
          "order_index": 2,
          "party": "church",
          "user_id": "daniel",
          "name": null,
          "title": "Area Manager",
          "method": "click",
          "status": "pending",
          "signed_at": null,
          "authority_ok": true
        },
        {
          "order_index": 3,
          "party": "partner",
          "user_id": null,
          "name": "Dr. Sok Vanna",
          "title": "Hospital Director",
          "method": "wet_ink",
          "status": "pending",
          "signed_at": null,
          "authority_ok": true
        }
      ],
      "attestations": {
        "supplements_local": true,
        "no_dependency": true,
        "not_primary_support": true,
        "partner_verified": true
      },
      "screening": {
        "date": "2026-07-15",
        "result": "clear"
      },
      "due_diligence": "verified",
      "obligations": [],
      "sent_at": null,
      "executed_at": null,
      "parent_contract_id": null,
      "amendment_no": 0,
      "log_ids": []
    },
    {
      "id": "AS-0144",
      "project_id": "WE26MMR0004",
      "partner": "Myanmar Red Cross Society",
      "partner_type": "local",
      "country": "MMR",
      "amount": 505000,
      "currency": "USD",
      "amount_usd": 505000,
      "status": "in_review",
      "template_id": "T-AMEND",
      "version_no": 1,
      "versions": [
        {
          "no": 1,
          "at": "2026-08-21",
          "author": "daniel",
          "summary": "Amendment 1: extend end date to 2027-03-31, no budget change"
        }
      ],
      "reviews": [
        {
          "division": "ogc",
          "order_index": 1,
          "assignee": "elena",
          "status": "pending",
          "due_at": "2026-08-28",
          "decided_at": null,
          "comment": ""
        },
        {
          "division": "finance",
          "order_index": 1,
          "assignee": "rafael",
          "status": "pending",
          "due_at": "2026-08-28",
          "decided_at": null,
          "comment": ""
        }
      ],
      "signatories": [
        {
          "order_index": 1,
          "party": "church",
          "user_id": "daniel",
          "name": null,
          "title": "Area Manager",
          "method": "click",
          "status": "pending",
          "signed_at": null,
          "authority_ok": true
        },
        {
          "order_index": 2,
          "party": "partner",
          "user_id": null,
          "name": "Dr. Myo Nyunt",
          "title": "President, MRCS",
          "method": "wet_ink",
          "status": "pending",
          "signed_at": null,
          "authority_ok": true
        }
      ],
      "attestations": {
        "supplements_local": true,
        "no_dependency": true,
        "not_primary_support": true,
        "partner_verified": true
      },
      "screening": {
        "date": "2026-01-30",
        "result": "clear"
      },
      "due_diligence": "verified",
      "obligations": [],
      "sent_at": null,
      "executed_at": null,
      "parent_contract_id": "AS-0140",
      "amendment_no": 1,
      "log_ids": []
    }
  ],
  "contract_seq": 145,
  "schema_version": 3
};
