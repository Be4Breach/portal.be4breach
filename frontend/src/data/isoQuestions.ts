export type IsoQuestion = {
  id: string;
  title: string;
  controlRef: string;
  domain: string;
  question: string;
  requiresEvidence: boolean;
  evidenceHint: string;
  risk: "Low" | "Medium" | "High";
  defaultRootCause: string;
  remediation: string[];
};

export const isoQuestions: IsoQuestion[] = [
  {
    id: "CL4.3",
    title: "ISMS Scope",
    controlRef: "Clause 4.3",
    domain: "Context",
    question:
      "Is the ISMS scope documented with systems, data types, locations, and exclusions?",
    requiresEvidence: true,
    evidenceHint:
      "Upload current ISMS scope with boundaries and exclusions noted.",
    risk: "Medium",
    defaultRootCause:
      "Scope not formally baselined or missing updates after architecture changes.",
    remediation: [
      "Publish updated scope statement",
      "Align asset inventory and data flows to scope",
    ],
  },
  {
    id: "CL5.1",
    title: "Leadership Commitment",
    controlRef: "Clause 5.1",
    domain: "Leadership",
    question:
      "Has top management approved and communicated the information security policy?",
    requiresEvidence: true,
    evidenceHint:
      "Signed policy and communication record (email/townhall notes).",
    risk: "Medium",
    defaultRootCause:
      "Policy or approval evidence not refreshed for the current year.",
    remediation: ["Record C-level sign-off", "Re-issue policy notice to staff"],
  },
  {
    id: "CL6.1",
    title: "Risk Assessment",
    controlRef: "Clause 6.1",
    domain: "Planning",
    question:
      "Is a defined risk assessment methodology applied to all in-scope assets?",
    requiresEvidence: true,
    evidenceHint: "Latest risk assessment output with methodology reference.",
    risk: "High",
    defaultRootCause: "Methodology not followed or not applied to new assets.",
    remediation: [
      "Run risk workshop for new assets",
      "Update methodology appendix",
    ],
  },
  {
    id: "CL6.2",
    title: "Risk Treatment",
    controlRef: "Clause 6.2",
    domain: "Planning",
    question:
      "Is there a current risk treatment plan linking risks to controls and owners?",
    requiresEvidence: true,
    evidenceHint: "Risk treatment plan with target dates and assigned owners.",
    risk: "High",
    defaultRootCause: "Treatment actions not tracked or owners unassigned.",
    remediation: [
      "Assign owners and due dates",
      "Link plan tasks to work tracker",
    ],
  },
  {
    id: "A5.7",
    title: "Threat Intelligence",
    controlRef: "A.5.7",
    domain: "Organizational",
    question:
      "Do you collect and act on threat intelligence relevant to your assets?",
    requiresEvidence: true,
    evidenceHint: "Recent threat intel report or feed subscription evidence.",
    risk: "Medium",
    defaultRootCause: "No defined intake or actioning of threat intel.",
    remediation: ["Subscribe to vetted feeds", "Document triage playbook"],
  },
  {
    id: "A5.23",
    title: "Cloud Services Security",
    controlRef: "A.5.23",
    domain: "Organizational",
    question:
      "Are cloud services evaluated and governed with security requirements and shared responsibility mapped?",
    requiresEvidence: true,
    evidenceHint:
      "Cloud security review, shared responsibility matrix, or CSP attestation.",
    risk: "High",
    defaultRootCause:
      "Cloud providers onboarded without structured security review.",
    remediation: [
      "Create cloud intake checklist",
      "Map controls to CSP services",
    ],
  },
  {
    id: "A5.30",
    title: "ICT Readiness for BC",
    controlRef: "A.5.30",
    domain: "Organizational",
    question:
      "Is ICT tested for business continuity (RTO/RPO) with documented results?",
    requiresEvidence: true,
    evidenceHint: "Latest DR/BC test report showing RTO/RPO results.",
    risk: "High",
    defaultRootCause: "BC/DR tests not run or results not captured.",
    remediation: ["Schedule DR exercise", "Track recovery metrics"],
  },
  {
    id: "A6.3",
    title: "Security Awareness",
    controlRef: "A.6.3",
    domain: "People",
    question:
      "Do all staff complete security awareness and role-based training annually?",
    requiresEvidence: true,
    evidenceHint: "Training completion export by role and date.",
    risk: "Medium",
    defaultRootCause: "Training cadence not enforced or records incomplete.",
    remediation: ["Automate reminders", "Add training to onboarding"],
  },
  {
    id: "A7.4",
    title: "Physical Security Monitoring",
    controlRef: "A.7.4",
    domain: "Physical",
    question:
      "Are secure areas monitored with access logs/CCTV and periodic reviews?",
    requiresEvidence: true,
    evidenceHint: "Access log sample or CCTV review record for last quarter.",
    risk: "Medium",
    defaultRootCause: "Monitoring not retained or reviewed on schedule.",
    remediation: ["Enable log retention", "Add quarterly physical review"],
  },
  {
    id: "A8.2",
    title: "Privileged Access",
    controlRef: "A.8.2",
    domain: "Technological",
    question:
      "Is privileged access approved, logged, and reviewed at least quarterly?",
    requiresEvidence: true,
    evidenceHint: "Privileged access review report with approvals.",
    risk: "High",
    defaultRootCause: "No periodic review of admin roles.",
    remediation: ["Schedule quarterly PAR", "Enforce break-glass logging"],
  },
  {
    id: "A8.9",
    title: "Configuration Management",
    controlRef: "A.8.9",
    domain: "Technological",
    question:
      "Are baseline configurations defined, enforced, and deviations tracked?",
    requiresEvidence: true,
    evidenceHint: "Baseline standard and config drift report.",
    risk: "High",
    defaultRootCause: "No baselines or drift monitoring in place.",
    remediation: [
      "Publish hardening guides",
      "Enable config compliance scanning",
    ],
  },
  {
    id: "A8.10",
    title: "Information Deletion",
    controlRef: "A.8.10",
    domain: "Technological",
    question:
      "Is information deleted securely at end of retention or when requested?",
    requiresEvidence: true,
    evidenceHint: "Data deletion logs or sanitization certificates.",
    risk: "Medium",
    defaultRootCause: "Deletion not automated or not evidenced.",
    remediation: [
      "Automate retention-based deletion",
      "Store wipe certificates",
    ],
  },
  {
    id: "A8.12",
    title: "Data Leakage Prevention",
    controlRef: "A.8.12",
    domain: "Technological",
    question:
      "Do you enforce DLP for email, endpoints, and cloud file sharing?",
    requiresEvidence: false,
    evidenceHint: "DLP policy set and recent incident log (optional).",
    risk: "Medium",
    defaultRootCause: "DLP not configured across channels.",
    remediation: ["Roll out DLP policies", "Tune alerts and exemptions"],
  },
  {
    id: "A8.16",
    title: "Monitoring Activities",
    controlRef: "A.8.16",
    domain: "Technological",
    question:
      "Are security events logged, correlated, and reviewed with defined thresholds?",
    requiresEvidence: true,
    evidenceHint: "SIEM dashboard screenshot or weekly review log.",
    risk: "High",
    defaultRootCause: "Logging not centralized or no review cadence.",
    remediation: ["Centralize logs to SIEM", "Define weekly triage"],
  },
  {
    id: "A8.23",
    title: "Web Filtering",
    controlRef: "A.8.23",
    domain: "Technological",
    question:
      "Is web filtering enforced for users with categories/allowlists reviewed?",
    requiresEvidence: false,
    evidenceHint: "Web filter policy export (optional).",
    risk: "Low",
    defaultRootCause: "Filters not consistently applied to all users.",
    remediation: [
      "Apply policy via endpoint agent",
      "Review categories quarterly",
    ],
  },
  {
    id: "A8.28",
    title: "Secure Coding",
    controlRef: "A.8.28",
    domain: "Technological",
    question:
      "Do developers follow secure coding standards with code review and SAST/DAST?",
    requiresEvidence: true,
    evidenceHint:
      "Secure coding standard and recent scan/report or PR checklist.",
    risk: "High",
    defaultRootCause: "No proof of secure SDLC controls.",
    remediation: ["Enforce PR security checklist", "Integrate SAST/DAST in CI"],
  },
];
