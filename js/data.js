// GENERATED from fixtures/*.json by the architect step — do not hand-edit numbers here.
// Regenerate whenever fixtures change. Every dashboard number must derive from this.
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
      "d_in_q_start": "2026-01-30"
    },
    {
      "id": "WE26BGD0003",
      "name": "WFP \u2014 School Feeding",
      "country": "BGD",
      "status": 4,
      "amount": 300000,
      "owner": "anik",
      "primary_implementer": "WFP",
      "target_date": "2026-09-15"
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
      "demo_role": "THE walk project \u2014 M2 submits, M1 approves through the full gate in the demo script"
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
      ]
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
      "past_target": true
    },
    {
      "id": "WE26NPL0011",
      "name": "Winterisation Support",
      "country": "NPL",
      "status": 4,
      "amount": 400000,
      "owner": "sunita",
      "target_date": "2026-10-30"
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
      }
    },
    {
      "id": "WE26IND0006",
      "name": "Mobility Devices",
      "country": "IND",
      "status": 1,
      "amount": 94200,
      "owner": "ravi",
      "implementation_date": "2026-07-01"
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
      }
    },
    {
      "id": "WE26MMR0004",
      "name": "Food Security Baskets",
      "country": "MMR",
      "status": 1,
      "amount": 505000,
      "owner": null,
      "implementation_date": "2026-05-01",
      "unassigned": true
    },
    {
      "id": "WE26MMR0009",
      "name": "Clinic Rehabilitation",
      "country": "MMR",
      "status": 3,
      "amount": 122000,
      "owner": null,
      "submitted_at": "2026-08-16",
      "unassigned": true
    },
    {
      "id": "WE26LAO0002",
      "name": "School WASH Blocks",
      "country": "LAO",
      "status": 4,
      "amount": 188000,
      "owner": null,
      "target_date": "2026-11-30",
      "unassigned": true
    }
  ],
  "reconciliation": {
    "BGD": 1310801,
    "NPL": 880400,
    "KHM": 612000,
    "IND": 354200,
    "MMR": 627000,
    "LAO": 188000,
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
    }
  ],
  "persona_switcher_order": [
    "anik",
    "daniel",
    "priya",
    "santoso"
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
  ]
,
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
  }
]
,
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
  }
]
,
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
  }
]
};
