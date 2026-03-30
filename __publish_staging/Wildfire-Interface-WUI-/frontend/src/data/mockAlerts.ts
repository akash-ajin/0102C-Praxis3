import type { AlertItem } from "../lib/types";

export const mockAlerts: AlertItem[] = [
  {
    id: "wf-edm-001",
    title: "Wildfire",
    region: "Chipewyan Lake, AB",
    issuedAt: "Issued Mar 27, 2026 · 9:15 PM",
    severity: "critical",
    description:
      "A fast-moving wildfire has been reported near the northeast edge of the region. Smoke may reduce visibility and air quality. Crews are responding and conditions can change quickly.",
    safetyInstructions: [
      "Prepare to evacuate if instructed; keep your vehicle fueled.",
      "Close windows/doors; set HVAC to recirculate to reduce smoke indoors.",
      "Keep emergency supplies ready: water, meds, chargers, and important documents.",
      "Follow local authority updates and avoid restricted areas."
    ]
  },
  {
    id: "wx-ice-002",
    title: "Freezing Rain",
    region: "Kingston – Odessa – Frontenac Islands, ON",
    issuedAt: "Issued Mar 27, 2026 · 7:42 PM",
    severity: "advisory",
    description:
      "Icy surfaces are expected overnight. Power interruptions are possible. Travel may become hazardous due to reduced traction.",
    safetyInstructions: [
      "Avoid unnecessary travel; slow down and allow extra stopping distance.",
      "Keep devices charged and have flashlights ready.",
      "Check on neighbors who may need assistance."
    ]
  },
  {
    id: "sys-test-003",
    title: "System Test",
    region: "Community Network",
    issuedAt: "Scheduled Mar 28, 2026 · 11:00 AM",
    severity: "test",
    description:
      "This is a planned system test of the neighborhood alert transmitter. No action is required.",
    safetyInstructions: [
      "No action required.",
      "If you do not see the test alert, report it via the contact button."
    ]
  }
];

